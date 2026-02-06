---
id: event-register
title: Event Registration - Înregistrare Tipuri Evenimente
sidebar_position: 4
---

# Event Registration - Înregistrare Tipuri Evenimente

Sistemul de înregistrare a tipurilor de evenimente permite clienților înrolați să definească și să gestioneze tipurile de evenimente pe care le pot publica în sistemul de webhooks.

## Prezentare Generală

### Scop
Permite clienților să:
- Înregistreze tipuri de evenimente (ex: `order.created`, `payment.completed`)
- Definească schema JSON pentru validarea payload-urilor
- Gestioneze ciclul de viață al evenimentelor (ACTIVE, INACTIVE, DEPRECATED)
- Interogeze tipurile de evenimente înregistrate

### Caracteristici Principale
- ✅ Validare client înainte de înregistrare
- ✅ Prevenire duplicate (constraint UNIQUE pe client_id + event_type)
- ✅ Validare JSON Schema
- ✅ Cache Redis pentru performanță
- ✅ Suport criptare date (security integration)
- ✅ Invalidare automată cache la modificări

## Arhitectură

### Componente Implicate

```
┌─────────────────┐
│   API Gateway   │
│  (Port 8080)    │
└────────┬────────┘
         │ Route: /api/v1/event-types
         ↓
┌─────────────────────────────────────┐
│  Webhook Management Service         │
│  (Port 8082)                        │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ EventRegistrationController  │  │
│  │  (REST Adapter)              │  │
│  └──────────┬───────────────────┘  │
│             ↓                       │
│  ┌──────────────────────────────┐  │
│  │ EventRegistrationService     │  │
│  │  (Application Layer)         │  │
│  └──────────┬───────────────────┘  │
│             ↓                       │
│  ┌──────────────────────────────┐  │
│  │ EventType (Domain Entity)    │  │
│  └──────────┬───────────────────┘  │
│             ↓                       │
│  ┌──────────────────────────────┐  │
│  │ EventTypeRepository (JPA)    │  │
│  │ EventTypeCache (Redis)       │  │
│  │ ClientKeyCache (Redis)       │  │
│  └──────────┬───────────────────┘  │
└─────────────┼───────────────────────┘
              ↓
   ┌──────────────────┐    ┌──────────────┐
   │   PostgreSQL     │    │    Redis     │
   │  (event_types)   │    │   (cache)    │
   └──────────────────┘    └──────────────┘
```

## Model de Date

### PostgreSQL - Tabel `event_types`

```sql
CREATE TABLE event_types (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_schema JSONB,
    event_description VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uk_client_event_type UNIQUE (client_id, event_type),
    CONSTRAINT ck_event_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'DEPRECATED'))
);
```

**Indecși**:
- `idx_event_types_client_id` - Query-uri per client
- `idx_event_types_event_type` - Căutare după tip
- `idx_event_types_status` - Filtrare după status
- `idx_event_types_created_at` - Sortare cronologică
- `idx_event_types_schema_gin` - Query-uri JSON în schema

### Redis Cache

**Pattern chei**: `event_types:client:{clientId}`

**Valoare**: Lista de EventType serializată JSON
```json
[
  {
    "eventId": "660f9511-f3ac-52e5-b827-557766551111",
    "clientId": "550e8400-e29b-41d4-a716-446655440000",
    "eventType": "order.created",
    "eventSchema": "{\"type\":\"object\",...}",
    "eventDescription": "Order creation event",
    "status": "ACTIVE",
    "createdAt": "2026-02-05T10:30:00",
    "updatedAt": null
  }
]
```

**TTL**: 3600 secunde (1 oră)

## API Endpoints

### POST /api/v1/event-types

Înregistrează un nou tip de eveniment pentru un client.

#### Request

**Headers**:
```
Content-Type: application/json
```

**Body**:
```json
{
  "clientId": "550e8400-e29b-41d4-a716-446655440000",
  "encryptedData": "BASE64_ENCRYPTED_JSON"
}
```

**Payload Decriptat** (structura datelor criptate):
```json
{
  "eventType": "order.created",
  "eventSchema": null,
  "eventDescription": "Event triggered when a new order is created"
}
```

**⚠️ Note Importante:**
- `clientId` **NU** este inclus în datele criptate - este trimis separat în root payload
- `eventSchema` poate fi `null` (validare JSON Schema opțională)
- `eventType` și `eventDescription` sunt obligatorii în payload-ul criptat

#### Response

**Success (201 Created)**:
```json
{
  "eventId": "660f9511-f3ac-52e5-b827-557766551111",
  "clientId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "order.created",
  "status": "ACTIVE",
  "createdAt": "2026-02-05T10:30:00"
}
```

**Errors**:

- **400 Bad Request**: JSON invalid, validare eșuată
```json
{
  "timestamp": "2026-02-05T10:30:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed: encryptedData: Encrypted data is required"
}
```

- **404 Not Found**: Client inexistent
```json
{
  "timestamp": "2026-02-05T10:30:00",
  "status": 404,
  "error": "Not Found",
  "message": "Client not found: 550e8400-e29b-41d4-a716-446655440000"
}
```

- **409 Conflict**: Tip eveniment deja există
```json
{
  "timestamp": "2026-02-05T10:30:00",
  "status": 409,
  "error": "Conflict",
  "message": "Event type 'order.created' already registered for client: 550e8400-e29b-41d4-a716-446655440000"
}
```

### GET /api/v1/event-types/client/{clientId}

Returnează toate tipurile de evenimente pentru un client.

#### Request

**Path Parameter**:
- `clientId` (UUID) - ID-ul clientului

#### Response

**Success (200 OK)**:
```json
{
  "clientId": "550e8400-e29b-41d4-a716-446655440000",
  "eventTypes": [
    {
      "eventId": "660f9511-f3ac-52e5-b827-557766551111",
      "clientId": "550e8400-e29b-41d4-a716-446655440000",
      "eventType": "order.created",
      "status": "ACTIVE",
      "createdAt": "2026-02-05T10:30:00"
    },
    {
      "eventId": "770f9511-f3ac-52e5-b827-557766552222",
      "clientId": "550e8400-e29b-41d4-a716-446655440000",
      "eventType": "payment.completed",
      "status": "ACTIVE",
      "createdAt": "2026-02-05T11:00:00"
    }
  ],
  "total": 2
}
```

**Error (404 Not Found)**:
```json
{
  "timestamp": "2026-02-05T10:30:00",
  "status": 404,
  "error": "Not Found",
  "message": "Client not found: 550e8400-e29b-41d4-a716-446655440000"
}
```

### GET /api/v1/event-types/discover

**✨ NOU**: Descoperă toate evenimentele active ale **altor clienți** (excluzând clientul curent).

#### Use Cases
- **Event Discovery**: Vezi ce evenimente publică alți clienți
- **Subscription Planning**: Alege la ce evenimente să te abonezi
- **System Overview**: Înțelege ecosistemul de evenimente disponibile

#### Request

**Query Parameter**:
- `excludeClientId` (UUID, required) - ID-ul clientului curent (va fi exclus din rezultate)

**Example**:
```bash
GET /api/v1/event-types/discover?excludeClientId=550e8400-e29b-41d4-a716-446655440000
```

#### Response

**Success (200 OK)**:
```json
{
  "eventTypes": [
    {
      "eventId": "880f9511-f3ac-52e5-b827-557766553333",
      "clientId": "660e8400-e29b-41d4-a716-446655441111",
      "eventType": "inventory.updated",
      "eventDescription": "Inventory level change event",
      "createdAt": "2026-02-05T09:15:00"
    },
    {
      "eventId": "990f9511-f3ac-52e5-b827-557766554444",
      "clientId": "770e8400-e29b-41d4-a716-446655442222",
      "eventType": "order.shipped",
      "eventDescription": "Order shipment notification",
      "createdAt": "2026-02-05T10:45:00"
    },
    {
      "eventId": "aa0f9511-f3ac-52e5-b827-557766555555",
      "clientId": "660e8400-e29b-41d4-a716-446655441111",
      "eventType": "user.registered",
      "eventDescription": "New user registration event",
      "createdAt": "2026-02-05T11:30:00"
    }
  ],
  "total": 3
}
```

**Caracteristici**:
- ✅ Returnează **doar evenimente ACTIVE** (exclude INACTIVE și DEPRECATED)
- ✅ Exclude evenimente ale clientului specificat în `excludeClientId`
- ✅ Sortare alfabetică după `eventType`
- ✅ Include `eventDescription` pentru contextualizare
- ✅ Nu necesită autentificare (public discovery - poate fi schimbat în viitor)

**Empty Result (200 OK)**:
```json
{
  "eventTypes": [],
  "total": 0
}
```

**Error (400 Bad Request)** - UUID invalid:
```json
{
  "timestamp": "2026-02-05T10:30:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Invalid UUID format: excludeClientId"
}
```

## Flow Înregistrare Eveniment

### Secvență Operații

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Manager
    participant Redis
    participant DB

    Client->>Gateway: POST /api/v1/event-types<br/>{clientId, encryptedData}
    Gateway->>Manager: Forward request
    
    Manager->>Redis: getClientKeys(clientId)
    alt Keys in cache
        Redis-->>Manager: ClientKeysData
    else Keys not in cache
        Manager->>DB: SELECT FROM clients
        DB-->>Manager: Client data
        Manager->>Redis: cacheClientKeys()
    end
    
    Manager->>Manager: decrypt(encryptedData, systemPrivateKey)
    
    Manager->>DB: SELECT FROM event_types<br/>WHERE client_id AND event_type
    
    alt Event type exists
        Manager-->>Gateway: 409 Conflict
        Gateway-->>Client: Error response
    else Event type not exists
        Manager->>Manager: validateSchema(eventSchema)
        Manager->>DB: INSERT INTO event_types
        DB-->>Manager: EventType saved
        
        Manager->>Redis: invalidate cache<br/>DEL event_types:client:{id}
        
        Manager-->>Gateway: 201 Created
        Gateway-->>Client: Success response
    end
```

### Pași Procesare

1. **Autentificare Request** (Gateway - implicit)
   - Validare token JWT (dacă implementat)
   - Rate limiting per client

2. **Validare DTO** (Controller)
   - `@Valid` annotare pe request body
   - Verificare `clientId` și `encryptedData` required

3. **Recuperare Chei Criptografice** (Service)
   - Apel `ClientKeyCache.getClientKeys(clientId)`
   - Dacă lipsește: fallback la DB + cache

4. **Decriptare Payload** (Service)
   - Utilizare `system_private_key` pentru decriptare
   - Deserializare JSON → `DecryptedEventPayload`

5. **Validare Business** (Service)
   - Verificare existență client în DB
   - Verificare duplicate: `existsByClientIdAndEventType()`
   - Validare JSON Schema (dacă furnizată)

6. **Persistență** (Repository)
   - INSERT în `event_types` cu status `ACTIVE`
   - Auto-generare `event_id` (UUID)
   - Timestamp `created_at` automat

7. **Invalidare Cache** (Cache)
   - DELETE `event_types:client:{clientId}`
   - Cache se reîncarcă la următorul GET

8. **Response** (Controller)
   - Construire DTO răspuns
   - Return 201 Created cu detalii eveniment

## Securitate & Criptografie

### Flux Criptare/Decriptare

Toate datele sensibile sunt criptate în transit:

**Client → Server (Request)**:
1. Client criptează payload cu `client_public_key`
2. Server decriptează cu `system_private_key`

**Server → Client (Response - viitor)**:
1. Server criptează răspuns cu `client_public_key`
2. Client decriptează cu `client_private_key`

### Storage Chei în Redis

**Key Pattern**: `client:keys:{clientId}`

**Valoare**:
```json
{
  "client_public_key": "-----BEGIN PUBLIC KEY-----\n...",
  "system_private_key": "-----BEGIN PRIVATE KEY-----\n..."
}
```

**Caracteristici**:
- TTL: Permanent (fără expirare)
- Format: JSON cu ambele chei
- Fallback: Dacă lipsește cache, se încarcă din DB

## Validări & Erori

### Validări Implementate

#### Request Level (Controller)
- `clientId`: NOT NULL, format UUID valid
- `encryptedData`: NOT BLANK

#### Business Level (Service)
- Client există în sistem
- Event type nu este duplicat pentru client
- JSON Schema valid (dacă furnizată)
- Payload decriptat are structură corectă

#### Database Level
- UNIQUE constraint pe (client_id, event_type)
- CHECK constraint pe status (ACTIVE/INACTIVE/DEPRECATED)
- NOT NULL pe câmpuri obligatorii

### Exception Handling

| Exception | HTTP Status | Message Example |
|-----------|-------------|-----------------|
| `ClientNotFoundException` | 404 | Client not found: {uuid} |
| `DuplicateEventTypeException` | 409 | Event type 'order.created' already registered |
| `InvalidEventSchemaException` | 400 | Invalid JSON format: ... |
| `HttpMessageNotReadableException` | 400 | Invalid request payload: Malformed JSON |
| `MethodArgumentNotValidException` | 400 | Validation failed: encryptedData is required |
| Generic `Exception` | 500 | An unexpected error occurred |

## Cache Strategy

### Pattern: Cache-Aside (Lazy Loading)

**Read Flow**:
```java
Optional<List<EventType>> cached = eventTypeCache.getEventTypesForClient(clientId);
if (cached.isPresent()) {
    return cached.get(); // Cache HIT
} else {
    List<EventType> fromDb = eventTypeRepository.findAllByClientId(clientId);
    eventTypeCache.cacheEventTypesForClient(clientId, fromDb); // Cache MISS
    return fromDb;
}
```

**Write Flow**:
```java
eventTypeRepository.save(eventType); // Write to DB
eventTypeCache.invalidateEventTypesForClient(clientId); // Invalidate cache
// Next GET will reload from DB
```

### Beneficii
- ✅ Reduce load pe PostgreSQL pentru query-uri frecvente
- ✅ Invalidare simplă (DELETE key)
- ✅ Consistență eventuală (cache se reîncarcă la următorul GET)
- ✅ TTL de 1 oră previne stale data

## Performanță

### Metrici Țintă

| Operație | Target | Observații |
|----------|--------|------------|
| POST /api/v1/event-types | < 500ms | Include decriptare + DB write |
| GET /api/v1/event-types (cache HIT) | < 50ms | Redis lookup foarte rapid |
| GET /api/v1/event-types (cache MISS) | < 200ms | DB query + cache write |

### Optimizări Implementate

1. **Redis Cache**: Reduce query-uri DB cu ~90%
2. **Connection Pooling**: HikariCP pentru PostgreSQL
3. **Indecși DB**: Covering indexes pentru query-uri frecvente
4. **JSONB**: Storage eficient și query-uri rapide pe schema
5. **Batch Operations**: Suport pentru multiple evenimente (viitor)

## Testing

### Unit Tests
- ✅ `EventRegistrationServiceTest` (8 teste)
  - Success flow
  - Client not found
  - Duplicate event type
  - Invalid schema
  - Decryption failed

### Integration Tests
- ✅ `EventTypeRepositoryTest` (12 teste)
  - CRUD operations
  - JSONB handling
  - Uniqueness constraints
  - Timestamps

- ✅ `RedisEventTypeCacheTest` (10 teste)
  - Cache hit/miss
  - Invalidation
  - Multiple clients
  - Large lists

### Manual Testing

**Script PowerShell**: `test-event-registration.ps1`

```powershell
# 1. Register event type
$clientId = "550e8400-e29b-41d4-a716-446655440000"
$payload = @{
    eventType = "order.created"
    eventSchema = '{"type":"object","properties":{"orderId":{"type":"string"}}}'
    eventDescription = "Order creation event"
} | ConvertTo-Json

# Encrypt payload (using security service)
$encrypted = Invoke-RestMethod -Uri "http://localhost:8081/encrypt" -Method POST `
  -Body (@{data=$payload; publicKey="CLIENT_PUBLIC_KEY"} | ConvertTo-Json)

# Send request
Invoke-RestMethod -Uri "http://localhost:8082/api/v1/event-types" -Method POST `
  -Body (@{clientId=$clientId; encryptedData=$encrypted.encryptedData} | ConvertTo-Json)

# 2. Get event types
Invoke-RestMethod -Uri "http://localhost:8082/api/v1/event-types/client/$clientId"
```

## Monitorizare & Logging

### Log Levels

**INFO**: Operații normale
```
[INFO] Securely registering event type 'order.created' for client 550e8400-...
[INFO] Event type registered successfully: 660f9511-...
```

**DEBUG**: Detalii tehnice
```
[DEBUG] Retrieved client keys from Redis for client: 550e8400-...
[DEBUG] Decrypted event type: 'order.created' for client 550e8400-...
```

**WARN**: Situații anormale (non-error)
```
[WARN] Client keys not found in Redis for client: 550e8400-... (fallback to DB)
```

**ERROR**: Erori
```
[ERROR] Failed to decrypt event payload for client 550e8400-...: Invalid key format
```

### Metrici de Monitorizat

- Request rate (requests/sec)
- Success/error rate (% 2xx vs 4xx/5xx)
- Response time (p50, p95, p99)
- Cache hit rate (%)
- DB connection pool utilization

## Limitări Cunoscute

### Actuale
- ❌ Nu există suport pentru update event type (doar INSERT)
- ❌ Nu există soft delete (status INACTIVE trebuie setat manual în DB)
- ❌ Nu există paginare pentru GET (returnează toate eventele)
- ❌ Nu există rate limiting per client

### Viitoare Îmbunătățiri
- [ ] Update event type (PUT /api/v1/event-types/{eventId})
- [ ] Delete/Deprecate event type (DELETE sau PATCH status)
- [ ] Paginare și sortare pentru GET
- [ ] Filtrare după status
- [ ] Bulk registration (POST multiple events)
- [ ] Webhooks pentru event type changes
- [ ] Rate limiting configurable

## Referințe

### Documente Related
- [Event Registration Implementation Plan](../Rapoarte%20de%20implementare/Workflows/Event%20Registration/event-registration-implementation.md)
- [Client Enrollment Flow](./client-enrollment.md)
- [Security Service Integration](../security-service/README.md)

### API Documentation
- Swagger UI: http://localhost:8082/swagger-ui.html
- OpenAPI Spec: http://localhost:8082/v3/api-docs

### Code Locations
- Controller: `src/main/java/com/managerwebhooks/adapter/rest/EventRegistrationController.java`
- Service: `src/main/java/com/managerwebhooks/application/service/EventRegistrationService.java`
- Entity: `src/main/java/com/managerwebhooks/domain/EventType.java`
- Repository: `src/main/java/com/managerwebhooks/port/out/EventTypeRepository.java`
- Cache: `src/main/java/com/managerwebhooks/adapter/cache/RedisEventTypeCache.java`
