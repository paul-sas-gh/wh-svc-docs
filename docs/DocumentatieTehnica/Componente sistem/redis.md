---
id: redis
slug: /DocumentatieTehnica/Componente sistem/redis
title: Redis
---

# Redis

Descrierea rolului și funcționalității componentei Redis în arhitectura Secure WebHooks.

## Rolul Redis în Sistem

Redis servește ca **layer de caching în-memory** pentru optimizarea performanței sistemului webhook, cu două utilizări principale:

### 1. Client Enrollment - Stocare Temporară Chei (Faza 1)

**Scop**: Stocare temporară a perechii de chei publică/privată generate pentru client în timpul procesului de înrolare.

**Pattern**: Cheia Redis: `keypair:{clientId}`
**TTL**: 5 minute
**Format date**:
```json
{
  "systemPrivateKey": "-----BEGIN PRIVATE KEY-----...",
  "systemPublicKey": "-----BEGIN PUBLIC KEY-----...",
  "createdAt": "2026-01-07T10:30:00Z"
}
```

**Flux**:
```
1. Client solicită înrolare (GET /register)
   → Sistem generează keypair temporar
   → Salvează în Redis cu TTL 5 minute
   → Returnează publicKey către client

2. Client completează înrolare (POST /enroll/complete)
   → Sistem recuperează privateKey din Redis
   → Folosește pentru decriptare
   → Șterge din Redis după succes
```

**Motivație**:
- ✅ Cheia privată temporară nu trebuie păstrată persistent
- ✅ Expirare automată după 5 minute (securitate)
- ✅ Partajare între instanțe multiple ale serviciului

### 2. Event Registration - Cache Performanță

**Scop**: Cache pentru tipurile de evenimente înregistrate de clienți, reducând încărcarea PostgreSQL.

**Pattern**: Cheia Redis: `event_types:client:{clientId}`
**TTL**: 1 oră
**Format date**: Lista de obiecte EventType (serializat JSON)

**Flux citire (Cache-Aside Pattern)**:
```
GET /api/events/types?clientId=ABC
  ↓
1. Check Redis cache
   ├─ HIT: Return cached data (&lt;1ms)
   └─ MISS: 
      ├─ Query PostgreSQL (~10-50ms)
      ├─ Store in Redis (TTL=1h)
      └─ Return data
```

**Flux scriere (Write-Through + Invalidation)**:
```
POST /api/events/register
  ↓
1. Validate client exists (PostgreSQL)
2. Save new event type (PostgreSQL)
3. Invalidate Redis cache (DEL event_types:client:{clientId})
   → Next read will fetch fresh data from DB
```

**Motivație**:
- ✅ Operațiuni read-heavy: fiecare eveniment publicat necesită validare împotriva tipurilor înregistrate
- ✅ Performance: Redis &lt; 1ms vs PostgreSQL ~10-50ms
- ✅ Scalabilitate: Reduce load pe PostgreSQL cu 99%+ pentru query-uri repetate
- ✅ Distributed: Cache partajat între multiple instanțe ale serviciului

**Impact performanță**:
```
Fără Redis:
- GET /api/events/types: ~50ms (PostgreSQL query)
- 1000 req/sec = 1000 PostgreSQL queries/sec

Cu Redis (cache hit):
- GET /api/events/types: ~1-2ms (Redis)
- 1000 req/sec = 1 PostgreSQL query + 999 Redis hits
- Performance gain: 25-50x mai rapid
- Database load reduction: 99.9%
```

## Responsabilități Redis vs PostgreSQL

| Aspect | Redis | PostgreSQL |
|--------|-------|------------|
| **Rol** | Cache temporar / Performanță | Source of truth persistent |
| **Durabilitate** | În-memory, volatil | Persistent pe disk, ACID |
| **TTL** | 5 min (enrollment), 1h (events) | Permanent |
| **Consistență** | Eventually consistent | Immediately consistent |
| **Rebuild** | Poate fi reconstruit din PostgreSQL | Nu poate fi reconstruit |
| **Fallback** | Queries on miss → PostgreSQL | N/A - always queried on cache miss |

## Arhitectură și Patternuri

### Cache-Aside Pattern (pentru Event Registration)

Pattern folosit pentru cache-ul de event types:

```
┌─────────────────────────────────────────────────────────┐
│                    Cache-Aside Pattern                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Read Flow:                                              │
│  1. Application checks Redis cache                       │
│  2. If HIT → return data (fast path)                     │
│  3. If MISS → query PostgreSQL                           │
│  4. Store result in Redis                                │
│  5. Return data                                          │
│                                                          │
│  Write Flow:                                             │
│  1. Application writes to PostgreSQL                     │
│  2. Invalidate Redis cache entry                         │
│  3. Next read will fetch fresh data from PostgreSQL      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Avantaje**:
- ✅ Cache este lazy-loaded (populat la cerere)
- ✅ Simple invalidation strategy
- ✅ Cache miss nu blochează operațiunea
- ✅ PostgreSQL rămâne source of truth

**Implementare în cod**:
```java
// EventRegistrationService.java
public EventTypesListResponse getEventTypesForClient(UUID clientId) {
    // 1. Try cache first
    return eventTypeCache.getEventTypesForClient(clientId)
        .map(this::toResponse)
        .orElseGet(() -> {
            // 2. Cache miss - fetch from DB
            List<EventType> eventTypes = eventTypeRepository.findAllByClientId(clientId);
            
            // 3. Store in cache
            eventTypeCache.cacheEventTypesForClient(clientId, eventTypes);
            
            return toResponse(clientId, eventTypes);
        });
}

public void registerEventType(RegisterEventTypeCommand command) {
    // 1. Save to PostgreSQL
    EventType saved = eventTypeRepository.save(eventType);
    
    // 2. Invalidate cache
    eventTypeCache.invalidateEventTypesForClient(command.clientId());
}
```

### Write-Through with TTL (pentru Client Enrollment)

Pattern folosit pentru chei temporare de enrollment:

```
┌─────────────────────────────────────────────────────────┐
│              Write-Through with TTL Pattern              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Write Flow (GET /register):                             │
│  1. Generate keypair                                     │
│  2. Write directly to Redis with TTL (5 minutes)         │
│  3. Return public key to client                          │
│                                                          │
│  Read Flow (POST /enroll/complete):                      │
│  1. Read from Redis                                      │
│  2. If NOT FOUND → enrollment expired (404)              │
│  3. Use private key for decryption                       │
│  4. Save final keys to PostgreSQL                        │
│  5. Delete from Redis (cleanup)                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Avantaje**:
- ✅ Expirare automată prin TTL (securitate)
- ✅ Nu necesită persistență (datele sunt temporare)
- ✅ Redis ca temporary state store
- ✅ Cleanup automat după 5 minute

### Strategii de Cache Invalidation

**1. Delete on Write (Event Registration)**
```java
// După înregistrarea unui event type nou
eventTypeCache.invalidateEventTypesForClient(clientId);
// Șterge cache-ul pentru a forța refresh la următoarea citire
```

**2. Explicit Delete (Client Enrollment)**
```java
// După completarea enrollment-ului cu succes
temporaryKeyRepository.deleteById(clientId);
// Șterge cheia temporară pentru curățare și securitate
```

**3. TTL-based Expiration (ambele)**
```java
// Redis șterge automat după expirare
// - Enrollment keys: 5 minute
// - Event types cache: 1 oră
```

### Best Practices Implementate

**1. Key Naming Convention**
```
Pattern: {domain}:{entity}:{identifier}
Examples:
  - keypair:{clientId}              # Enrollment keys
  - event_types:client:{clientId}   # Event types cache
```

**2. Serialization Strategy**
- JSON pentru date complexe (List&lt;EventType&gt;&lt;)
- String pentru date simple (single values)
- Configurare Jackson pentru consistency cu PostgreSQL

**3. Error Handling**
```java
try {
    // Redis operation
    redisTemplate.opsForValue().set(key, value, ttl);
} catch (Exception e) {
    // Log error but don't fail the operation
    log.warn("Failed to cache data: {}", e.getMessage());
    // Application continues with PostgreSQL fallback
}
```

**4. Graceful Degradation**
- Redis failure NU blochează operațiunea
- Cache miss → fallback la PostgreSQL
- System funcționează (mai lent) chiar dacă Redis este down

### Performance Metrics

**Cache Hit Rate Target**: >90% pentru event types queries

**Latency Comparison**:
| Operation | PostgreSQL | Redis | Improvement |
|-----------|-----------|-------|-------------|
| Read single client's events | ~50ms | ~1ms | 50x |
| Read 100 times/sec | 5000ms/sec | 100ms/sec | 50x |
| Database connections | 100 | 1 (initial) | 99% reduction |

## Deploy Redis cu Docker Compose

Redis rulează ca serviciu Docker folosind imaginea oficială `redis:7.4.6`.

```yaml
redis:
  image: redis:7.4.6
  container_name: wh-redis
  ports:
    - "6379:6379"
  networks:
    - webhooks-network
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

## Comenzi utile pentru Redis CLI

### Conectare și Diagnosticare

- **Conectare la container Redis:**
  ```bash
  docker exec -it wh-redis redis-cli
  ```

- **Ping server Redis:**
  ```bash
  PING
  # Expected: PONG
  ```

- **Verificare info server:**
  ```bash
  INFO
  # sau pentru secțiuni specifice:
  INFO memory
  INFO stats
  ```

### Operațiuni pe Chei

- **Listare toate cheile:**
  ```bash
  KEYS *
  # Caution: Expensive operation in production!
  ```

- **Listare chei cu pattern:**
  ```bash
  KEYS keypair:*        # Toate cheile de enrollment
  KEYS event_types:*    # Toate cache-urile de event types
  ```

- **Verificare existență cheie:**
  ```bash
  EXISTS keypair:550e8400-e29b-41d4-a716-446655440000
  # Returns: 1 (exists) or 0 (doesn't exist)
  ```

- **Verificare TTL:**
  ```bash
  TTL keypair:550e8400-e29b-41d4-a716-446655440000
  # Returns: seconds remaining or -1 (no expiry) or -2 (doesn't exist)
  ```

### Operațiuni CRUD

- **Obținere valoare cheie:**
  ```bash
  GET keypair:550e8400-e29b-41d4-a716-446655440000
  ```

- **Setare cheie cu TTL:**
  ```bash
  SETEX keypair:550e8400-e29b-41d4-a716-446655440000 300 '{"systemPrivateKey":"...","systemPublicKey":"..."}'
  # Sets key with 5 minutes (300 seconds) expiry
  ```

- **Setare cheie fără TTL:**
  ```bash
  SET event_types:client:abc123 '[{"eventId":"...","eventType":"order.created"}]'
  ```

- **Ștergere cheie:**
  ```bash
  DEL keypair:550e8400-e29b-41d4-a716-446655440000
  # Returns: number of keys deleted
  ```

- **Ștergere multiple chei:**
  ```bash
  DEL key1 key2 key3
  ```

### Monitorizare și Debugging

- **Monitorizare comenzi în timp real:**
  ```bash
  MONITOR
  # Shows all commands executed on Redis (Ctrl+C to stop)
  ```

- **Număr total chei:**
  ```bash
  DBSIZE
  # Returns: total number of keys in current database
  ```

- **Memorie folosită:**
  ```bash
  MEMORY USAGE keypair:550e8400-e29b-41d4-a716-446655440000
  # Returns: bytes used by key
  ```

### Curățare și Mentenanță

- **Flush toate cheile (DANGEROUS!):**
  ```bash
  FLUSHDB
  # Deletes all keys in current database
  ```

- **Scan chei (production-safe alternative to KEYS):**
  ```bash
  SCAN 0 MATCH keypair:* COUNT 100
  # Returns: cursor and keys (iterate with returned cursor)
  ```

### Exemple Specifice Sistemului

**Verificare chei enrollment active:**
```bash
KEYS keypair:*
# Lista toți clienții în proces de enrollment
```

**Verificare cache event types pentru client specific:**
```bash
GET event_types:client:550e8400-e29b-41d4-a716-446655440000
# Vezi ce event types sunt cached pentru clientul respectiv
```

**Invalidare manuală cache pentru un client:**
```bash
DEL event_types:client:550e8400-e29b-41d4-a716-446655440000
# Forțează refresh din PostgreSQL la următoarea citire
```

**Monitorizare TTL chei enrollment:**
```bash
TTL keypair:550e8400-e29b-41d4-a716-446655440000
# Verifică cât timp mai are clientul pentru a completa enrollment-ul
```

## Resurse
- [Documentație Redis](https://redis.io/docs/)
- [Comenzi Redis CLI](https://redis.io/commands/)
