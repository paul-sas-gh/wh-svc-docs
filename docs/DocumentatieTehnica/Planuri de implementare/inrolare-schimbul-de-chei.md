---
id: inrolare-schimbul-de-chei
title: Plan Implementare - Înrolare Faza 2
---

# Plan de Implementare: Înrolare Client - Faza 2 (Schimb Securizat de Chei)

Acest plan detaliază implementarea celei de-a doua faze a procesului de înrolare a clienților, concentrându-se pe schimbul securizat de chei publice și stabilirea canalului de încredere criptografic.

## 1. Descrierea funcționalității

Obiectivul este finalizarea procesului de înrolare prin schimbul cheilor publice între client și sistem într-un mod securizat. Clientul trimite cheia sa publică criptată cu cheia publică temporară a sistemului (primită în Faza 1). Sistemul decriptează cheia clientului, generează o pereche finală de chei dedicate acestui client, stochează cheile și returnează cheia publică finală a sistemului, criptată cu cheia publică a clientului.

## 2. Componente implicate

*   **API Gateway**: Expunere și rutare endpoint public.
*   **Webhook Management Service**: Componenta centrală care orchestrează fluxul, execută operațiuni criptografice și gestionează persistența.
*   **Security Service**: Generator de chei criptografice (RSA).
*   **Redis**: Sursă pentru cheia privată temporară generată în Faza 1.
*   **PostgreSQL**: Stocare persistentă a datelor clientului și a cheilor finale.

## 3. Arhitectură tehnică

### Webhook Management Service
Se va utiliza arhitectura hexagonală existentă:
*   **Inbound Adapter (REST)**: `ClientEnrollmentController` va expune endpoint-ul `/set-client-public-key`.
*   **Domain Service**: `ClientEnrollmentService` va implementa logica de business (orchestrare flux).
*   **Outbound Ports**:
    *   `TemporaryKeyRepository` (Redis) - pentru recuperarea datelor temporare de înregistrare.
    *   `ClientRepository` (PostgreSQL) - pentru salvarea clientului și a cheilor.
    *   `SecurityServicePort` (Security Service) - pentru operațiuni criptografice:
        *   Generare perechi de chei
        *   Decriptare date cu cheie privată
        *   Criptare date cu cheie publică

### Security Service
Va expune endpoint-uri dedicate pentru toate operațiunile criptografice (existente din Faza 1).:
*   **GET /generate-keypair** - Generare pereche de chei RSA 
*   **POST /decrypt** - Decriptare date cu cheie privată.
*   **POST /encrypt** - Criptare date cu cheie publică.

## 4. Modele de date

### PostgreSQL (Webhook Management Service)
Tabel nou: `clients` (sau actualizare dacă există un tabel parțial din Faza 1).

```sql
CREATE TABLE clients (
    client_id UUID PRIMARY KEY,
    client_public_key TEXT NOT NULL, -- Cheia publică a clientului (PEM format)
    system_private_key TEXT NOT NULL, -- Cheia privată a sistemului pentru acest client (PEM format, posibil criptată la rest)
    system_public_key TEXT NOT NULL, -- Cheia publică a sistemului pentru acest client (PEM format)
    status VARCHAR(50) NOT NULL, -- ex: 'ACTIVE', 'PENDING'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Redis (Existent din Faza 1)
Cheie: `enrollment:{clientId}`
Valoare (JSON):
```json
{
  "systemPrivateKey": "...",
  "systemPublicKey": "...",
  "createdAt": "..."
}
```

## 5. API-uri

### API Gateway -> Webhook Management Service

**Endpoint**: `POST /set-client-public-key`

**Request Body**:
```json
{
  "clientId": "550e8400-e29b-41d4-a716-446655440000",
  "encryptedClientPublicKey": "Base64EncodedString..." 
}
```

**Response Body (Success 200)**:
```json
{
  "encryptedSystemPublicKey": "Base64EncodedString..."
}
```

**Response (Error 400/404/500)**:
```json
{
  "code": "ERROR_CODE",
  "message": "Description of error"
}
```

### Webhook Management Service -> Security Service

**Endpoint 1**: `POST /generate-keypair` (Existent din Faza 1)

**Response**:
```json
{
  "publicKey": "PEM...",
  "privateKey": "PEM..."
}
```

**Endpoint 2**: `POST /decrypt` (Nou)

**Request Body**:
```json
{
  "encryptedData": "Base64EncodedString...",
  "privateKey": "PEM format private key..."
}
```

**Response**:
```json
{
  "decryptedData": "Base64EncodedString..." 
}
```

**Endpoint 3**: `POST /encrypt` (Nou)

**Request Body**:
```json
{
  "data": "Base64EncodedString...",
  "publicKey": "PEM format public key..."
}
```

**Response**:
```json
{
  "encryptedData": "Base64EncodedString..."
}
```

## 6. Fluxuri de comunicare

```mermaid
sequenceDiagram
    participant Gateway as API Gateway
    participant Manager as Webhook Management
    participant Redis
    participant Security as Security Service
    participant DB as PostgreSQL

    Gateway->>Manager: POST /set-client-public-key
    activate Manager
    
    Manager->>Redis: GET enrollment:{clientId}
    Redis-->>Manager: {systemPrivKey, ...}
    
    alt Cheie temporară nu există sau a expirat
        Manager-->>Gateway: 404 Not Found / 400 Bad Request
    end

    Manager->>Security: POST /decrypt (encryptedClientPubKey, systemPrivKey)
    Security-->>Manager: {decryptedData: clientPubKey}
    Note right of Manager: Security Service decriptează clientPubKey

    Manager->>Security: POST /generate-keypair
    Security-->>Manager: {finalSystemPubKey, finalSystemPrivKey}

    Manager->>DB: INSERT INTO clients (id, clientPubKey, finalSystemPrivKey, finalSystemPubKey)
    
    Manager->>Security: POST /encrypt (finalSystemPubKey, clientPubKey)
    Security-->>Manager: {encryptedData}
    Note right of Manager: Security Service criptează finalSystemPubKey

    Manager->>Redis: DEL enrollment:{clientId} (Cleanup)

    Manager-->>Gateway: 200 OK { encryptedSystemPubKey }
    deactivate Manager
```

## 7. Dependențe

### Webhook Management Service
*   **Spring Data JPA**: Pentru persistența în PostgreSQL.
*   **Spring Data Redis**: Pentru accesul la Redis.
*   **Spring Cloud OpenFeign**: Pentru comunicarea cu Security Service.

### Security Service
*   **Java Security / Bouncy Castle**: Pentru operațiunile de criptare/decriptare RSA.
*   **Spring Boot**: Framework de bază pentru expunere API-uri REST.

## 8. Secvență de implementare

1.  **Infrastructură - PostgreSQL Container**:
    *   Adăugare serviciu PostgreSQL în `wh-docker-system/docker-compose.yml`:
        ```yaml
        postgres:
          image: postgres:16-alpine
          container_name: wh-postgres
          ports:
            - "5432:5432"
          environment:
            - POSTGRES_DB=webhooks
            - POSTGRES_USER=webhooks_user
            - POSTGRES_PASSWORD=webhooks_pass
          volumes:
            - postgres-data:/var/lib/postgresql/data
          networks:
            - webhooks-network
          restart: unless-stopped
          healthcheck:
            test: ["CMD-SHELL", "pg_isready -U webhooks_user -d webhooks"]
            interval: 30s
            timeout: 10s
            retries: 3
            start_period: 40s
        ```
    *   Adăugare volum persistent pentru date:
        ```yaml
        volumes:
          postgres-data:
        ```
2.  **Baza de date - Schema**: ✅ **IMPLEMENTAT** (4 ian 2026)
    *   ✅ Script migrare Flyway creat: `V1__create_clients_table.sql`
    *   ✅ Tabel `clients` creat în PostgreSQL cu 7 coloane
    *   ✅ Indecși de performanță adăugați (status, created_at)
    *   ✅ Migrare executată cu succes
    *   📄 Documentație: `wh-svc-docs/docs/DocumentatieTehnica/Rapoarte de implementare/Workflows/Inrolare Client - Schimb de chei/IMPLEMENTATION-STEP2-DATABASE-SCHEMA.md`
3.  **Security Service - endpoint-uri criptografice**: ✅ **VALIDAT** (4 ian 2026)
    *   ✅ Endpoint `POST /decrypt` funcțional
        *   Request: `{encryptedData, privateKey}`
        *   Response: `{decryptedData}`
        *   Utilizare Java Security pentru decriptare RSA
    *   ✅ Endpoint `POST /encrypt` funcțional
        *   Request: `{data, publicKey}`
        *   Response: `{encryptedData}`
        *   Utilizare Java Security pentru criptare RSA
    *   ✅ Validări pentru format chei și date implementate
    *   ✅ Tratare erori criptografice (InvalidKeyException, BadPaddingException)
    *   ✅ Teste end-to-end executate cu succes
    *   📄 Documentație: `wh-svc-docs/docs/DocumentatieTehnica/Rapoarte de implementare/Workflows/Inrolare Client - Schimb de chei/VALIDATION-STEP3-CRYPTO-ENDPOINTS.md`
4.  **Webhook Management Service - Configurare conexiune DB**: ✅ **COMPLETAT** (4 ian 2026)
    *   ✅ Adăugare dependențe în `pom.xml`: PostgreSQL driver, Spring Data JPA
    *   ✅ Configurare `application.properties` pentru conexiunea la PostgreSQL
    *   ✅ Creare test DatabaseConnectionTest pentru validare conexiune
    *   ✅ Validare finală conexiune și connection pool
    *   ✅ Toate teste passed (4/4): conexiune DB, JdbcTemplate, tabel clients, Flyway migration
    *   📄 Documentație: `wh-svc-docs/docs/DocumentatieTehnica/Rapoarte de implementare/Workflows/Inrolare Client - Schimb de chei/IMPLEMENTATION-STEPS-4-5-SUMMARY.md`
5.  **Webhook Management Service - Domain**: ✅ **COMPLETAT** (4 ian 2026)
    *   ✅ Actualizare entitate `Client` (JPA entity) cu câmpuri criptografice
    *   ✅ Adăugare annotări JPA (@Entity, @Table, @Id, @Column)
    *   ✅ Adăugare câmpuri: clientPublicKey, systemPrivateKey, systemPublicKey
    *   ✅ Implementare lifecycle hooks (@PrePersist, @PreUpdate)
    *   ✅ Creare factory method createEnrolled() și metode business
    *   ✅ Creare teste unitare pentru entitate (ClientTest.java - 6 tests)
    *   ✅ Creare teste de persistență JPA (ClientPersistenceTest.java - 5 tests)
    *   ✅ Fix compilation errors în InMemoryClientRepository
    *   ✅ Fix test timing issue în testSuspend()
    *   📄 Documentație: `wh-svc-docs/docs/DocumentatieTehnica/Rapoarte de implementare/Workflows/Inrolare Client - Schimb de chei/IMPLEMENTATION-STEPS-4-5-SUMMARY.md`
6.  **Webhook Management Service - Adapters**: ✅ **COMPLETAT** (4 ian 2026)
    *   ✅ **SecurityServiceFeignClient** actualizat:
        *   Adăugate metode `decrypt()` și `encrypt()`
        *   Create DTOs: DecryptRequest/Response, EncryptRequest/Response
        *   Renamed SecurityServiceResponse → KeypairResponse
    *   ✅ **SecurityServiceAdapter** extins:
        *   Implementată metodă `decrypt(encryptedData, privateKey)` → decryptedData
        *   Implementată metodă `encrypt(data, publicKey)` → encryptedData
        *   Logging complet și exception handling
    *   ✅ **TemporaryKeyRepository** port interface creat:
        *   Metodă `findById(UUID clientId)` → Optional&lt;TemporaryKeyData&gt;
        *   Metodă `deleteById(UUID clientId)` → void (cleanup după înrolare)
        *   Record TemporaryKeyData(publicKey, privateKey)
    *   ✅ **RedisKeypairRepository** implementat:
        *   Adapter pentru recuperare chei temporare din Redis
        *   Key format: `keypair:{clientId}`, TTL 5 minute
        *   Handling erori și logging complet
    *   ✅ **SpringDataClientRepository** interface creat:
        *   Extends JpaRepository&lt;Client, UUID&gt;
        *   Metode CRUD automate pentru Client entity
    *   ✅ **JpaClientRepositoryAdapter** implementat:
        *   Adapter JPA pentru persistență PostgreSQL
        *   @Primary și @ConditionalOnProperty(client.repository.type=jpa)
        *   Delegare către SpringDataClientRepository
    *   ✅ **InMemoryClientRepository** actualizat:
        *   Adăugat @ConditionalOnProperty(client.repository.type=in-memory)
        *   Activare condițională pentru teste
    *   📄 Documentație: Toate fișierele create și compilare cu succes
7.  **Webhook Management Service - Application**: ✅ **COMPLETAT** (6 ian 2026)
    *   Implementare `ClientEnrollmentService` finalizată.
    *   Logica: 
        1. Retrieve Redis (sistemPrivKey)
        2. Call Security Service `/decrypt` (encryptedClientPubKey, systemPrivKey)
        3. Call Security Service `/generate-keypair` (finalKeys)
        4. Save DB (Client entity)
        5. Call Security Service `/encrypt` (finalSystemPubKey, clientPubKey)
        6. Delete Redis entry (cleanup)
        7. Return encrypted response
    *   Tratare erori (chei invalide, erori decriptare, Redis miss, Security Service failures).
8.  **Webhook Management Service - API**: ✅ **COMPLETAT** (6 ian 2026)
    *   Creare DTO-uri (`CompleteEnrollmentRequest`, `CompleteEnrollmentResponse`).
    *   Implementare controller `ClientEnrollmentController` cu endpoint-ul `/enroll/complete`.
    *   Documentație OpenAPI, validare input și răspunsuri de eroare consistente.
9.  **API Gateway**:
    *   Configurare rută în `application.yml` pentru `/set-client-public-key`.

## 9. Teste

*   **Unit Tests (Service Layer)**:
    *   Mock `RedisRepository` pentru a returna o cheie privată de test.
    *   Mock `SecurityService` pentru a returna o pereche de chei nouă.
    *   Mock `ClientRepository`.
    *   Testare flux succes: verificare decriptare corectă și apelare metode repository.
    *   Testare erori: cheie Redis lipsă, format cheie invalid (crypto exception).
*   **Integration Tests**:
    *   Test cu container Redis și PostgreSQL (Testcontainers).
    *   Verificare că datele sunt salvate corect în DB.
    *   Verificare că cheia din Redis este ștearsă după succes (opțional, dar recomandat).
*   **Security Tests**:
    *   Verificare că endpoint-ul acceptă doar payload valid.
    *   Verificare comportament la chei publice malformate.
