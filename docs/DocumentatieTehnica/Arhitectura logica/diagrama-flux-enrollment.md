# Diagrama Flux Enrollment Client (2-Phase)

**Ultima actualizare:** 7 februarie 2026  
**Status:** ✅ Implementat complet

## Flux Enrollment în 2 Faze

```mermaid
sequenceDiagram
    participant C as Client Application
    participant GW as Gateway<br/>(Port 8081)
    participant MGR as Manager<br/>(Port 8082)
    participant SEC as Security<br/>(Port 8080)
    participant REDIS as Redis<br/>(Cache)
    participant DB as PostgreSQL<br/>(Database)

    rect rgb(200, 220, 255)
    Note over C,DB: PHASE 1: Initial Registration
    
    C->>C: Generate RSA keypair<br/>(clientPublicKey, clientPrivateKey)
    C->>GW: POST /register
    Note over C,GW: {clientName, email}
    
    GW->>MGR: Forward registration
    MGR->>MGR: Validate input
    MGR->>MGR: Generate clientId (UUID)
    
    MGR->>SEC: POST /generate-keypair
    Note over MGR,SEC: Generate system keypair<br/>for this client
    SEC->>SEC: Generate RSA-2048 keypair
    SEC-->>MGR: {systemPublicKey, systemPrivateKey}
    
    MGR->>REDIS: Store temporary keys
    Note over MGR,REDIS: Key: temp_keys:{clientId}<br/>TTL: 15 minutes<br/>Data: {systemPublicKey,<br/>systemPrivateKey}
    
    MGR-->>GW: {clientId, systemPublicKey}
    GW-->>C: Response
    Note over C: Client stores:<br/>- clientId<br/>- systemPublicKey<br/>- Own clientPrivateKey
    end

    rect rgb(220, 255, 220)
    Note over C,DB: PHASE 2: Complete Enrollment
    
    C->>C: Encrypt clientPublicKey<br/>with systemPublicKey
    C->>GW: POST /enroll/complete/{clientId}
    Note over C,GW: {encryptedClientPublicKey}
    
    GW->>MGR: Forward enrollment
    MGR->>REDIS: GET temp_keys:{clientId}
    REDIS-->>MGR: {systemPublicKey, systemPrivateKey}
    
    MGR->>SEC: POST /decrypt
    Note over MGR,SEC: Decrypt with systemPrivateKey<br/>(temporary)
    SEC-->>MGR: clientPublicKey (decrypted)
    
    MGR->>SEC: POST /generate-keypair
    Note over MGR,SEC: Generate FINAL system keypair
    SEC->>SEC: Generate new RSA-2048 keypair
    SEC-->>MGR: {finalSystemPublicKey,<br/>finalSystemPrivateKey}
    
    MGR->>SEC: POST /encrypt
    Note over MGR,SEC: Encrypt finalSystemPublicKey<br/>with clientPublicKey
    SEC-->>MGR: encryptedFinalSystemPublicKey
    
    MGR->>DB: INSERT INTO clients
    Note over MGR,DB: Store:<br/>- clientId<br/>- clientName, email<br/>- clientPublicKey<br/>- finalSystemPublicKey<br/>- finalSystemPrivateKey<br/>- status: ACTIVE
    
    MGR->>REDIS: Cache client keys
    Note over MGR,REDIS: Key: client_keys:{clientId}<br/>TTL: 1 hour
    
    MGR->>REDIS: DELETE temp_keys:{clientId}
    Note over MGR,REDIS: Cleanup temporary keys
    
    MGR-->>GW: {encryptedFinalSystemPublicKey}
    GW-->>C: Success response
    
    C->>SEC: POST /decrypt
    Note over C,SEC: Decrypt with clientPrivateKey
    SEC-->>C: finalSystemPublicKey (clear)
    
    C->>C: Save to client-config.json:<br/>- clientId<br/>- clientName<br/>- clientPublicKey<br/>- clientPrivateKey<br/>- serverPublicKey (final)
    end
    
    Note over C,DB: ✅ Enrollment Complete<br/>Client ready for webhook operations
```

---

## Componente de Securitate

### Chei Generate în Proces

| Cheie | Generată de | Stocată în | Folosită pentru |
|-------|-------------|-----------|-----------------|
| **clientPublicKey** | Client | DB + client-config.json | Manager verifică identitatea client |
| **clientPrivateKey** | Client | client-config.json (SECRET) | Client decriptează mesaje primite |
| **systemPublicKey (temp)** | Security | Redis (TTL 15 min) | Phase 1 - transmitere securizată clientPublicKey |
| **systemPrivateKey (temp)** | Security | Redis (TTL 15 min) | Phase 1 - decriptare clientPublicKey |
| **systemPublicKey (final)** | Security | DB + Redis cache | Client criptează mesajele către sistem |
| **systemPrivateKey (final)** | Security | DB (SECRET) | Manager decriptează mesajele de la client |

---

## Validări și Securitate

### Phase 1 Validations

```mermaid
flowchart TD
    A[Receive Registration] --> B{clientName valid?}
    B -->|No| C[400 Bad Request]
    B -->|Yes| D{Email valid?}
    D -->|No| C
    D -->|Yes| E{Client exists?}
    E -->|Yes| F[409 Conflict]
    E -->|No| G[Generate clientId]
    G --> H[Generate system keypair]
    H --> I[Store temp keys in Redis]
    I --> J[Return clientId + systemPublicKey]
    
    style J fill:#4caf50
    style C fill:#f44336
    style F fill:#ff9800
```

### Phase 2 Validations

```mermaid
flowchart TD
    A[Receive Complete Enrollment] --> B{clientId exists?}
    B -->|No| C[404 Not Found]
    B -->|Yes| D{Temp keys in Redis?}
    D -->|No| E[410 Gone - Expired]
    D -->|Yes| F[Decrypt clientPublicKey]
    F --> G{Decryption OK?}
    G -->|No| H[400 Invalid Payload]
    G -->|Yes| I[Generate final system keypair]
    I --> J[Encrypt for client]
    J --> K[Store in PostgreSQL]
    K --> L[Cache in Redis]
    L --> M[Cleanup temp keys]
    M --> N[Return encrypted systemPublicKey]
    
    style N fill:#4caf50
    style C fill:#f44336
    style E fill:#ff9800
    style H fill:#f44336
```

---

## Timeouts și TTLs

| Resursa | TTL/Timeout | Motiv |
|---------|-------------|-------|
| **Redis temp_keys** | 15 minute | Client trebuie să completeze Phase 2 în 15 min |
| **Redis client_keys** | 1 oră | Cache chei pentru performanță |
| **HTTP timeout Phase 1** | 30 secunde | Generare keypair poate dura |
| **HTTP timeout Phase 2** | 30 secunde | Multiple crypto operations |

---

## Error Handling

### Scenarii Comune de Eroare

1. **Enrollment expirat** (temp keys deleted după 15 min)
   - Response: `410 Gone`
   - Soluție: Client reîncepe de la Phase 1

2. **Payload criptat invalid** (cheie greșită sau date corupte)
   - Response: `400 Bad Request - Decryption failed`
   - Soluție: Client verifică systemPublicKey folosit

3. **Client deja înregistrat** (duplicate clientName)
   - Response: `409 Conflict`
   - Soluție: Folosește alt nume sau reactivează clientul existent

4. **Redis indisponibil**
   - Response: `503 Service Unavailable`
   - Soluție: Client retry după câteva secunde

---

## Teste de Verificare

### Test Phase 1
```bash
curl -X POST http://localhost:8081/register \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "test-client",
    "email": "test@example.com"
  }'
```

**Expected Response:**
```json
{
  "clientId": "uuid-here",
  "systemPublicKey": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."
}
```

### Test Phase 2
```bash
curl -X POST http://localhost:8081/enroll/complete/{clientId} \
  -H "Content-Type: application/json" \
  -d '{
    "encryptedClientPublicKey": "base64-encrypted-data..."
  }'
```

**Expected Response:**
```json
{
  "encryptedSystemPublicKey": "base64-encrypted-final-key..."
}
```

---

## Metrici Enrollment

**Timpul mediu Phase 1:** ~200-300ms  
**Timpul mediu Phase 2:** ~300-400ms  
**Total enrollment:** ~500-700ms (ambele faze)  
**Success rate:** ~99.8%  
**Expirate (>15 min între faze):** ~2%

---

**Vezi și:**
- [Test Enrollment Flow](../../Rapoarte%20de%20implementare/Workflows/Inrolare%20Client%20-%20Schimb%20de%20chei/)
- [Client Enrollment Integration Test Summary](../../../wh-svc-manager/CLIENT-ENROLLMENT-INTEGRATION-TEST-SUMMARY.md)
