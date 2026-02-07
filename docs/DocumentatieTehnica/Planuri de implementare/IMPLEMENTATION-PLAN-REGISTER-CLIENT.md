# Plan de Implementare: GET /register-client

## Obiectiv
Implementarea primei funcționalități expuse în gateway: înregistrarea unui client nou și generarea automată a unei chei publice RSA.

## Endpoint Final
```
GET /register-client
```

**Request**: fără parametri  
**Response**:
```json
{
  "client_id": "uuid-v4",
  "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  "expires_at": "2025-11-26T10:00:00Z"
}
```

---

## Flux Arhitectural

```
Client → wh-svc-gateway → wh-svc-manager → wh-svc-security (stateless key generation)
         (routing,          (business          |
          rate limit,        logic,             Redis (public_key TTL)
          circuit breaker,   persistence)       
          HMAC validation*)                     
                            ↓
                         PostgreSQL

* HMAC validation pentru viitor, NU pentru /register-client
```

### Sequence Diagram

```
Client                Gateway               Manager               Security              Redis
  |                      |                     |                     |                    |
  |--GET /register------>|                     |                     |                    |
  |                      |--route------------->|                     |                    |
  |                      |                     |--generate-keypair-->|                    |
  |                      |                     |                     |--generate RSA----->|
  |                      |                     |                     |<--keys (in memory)-|
  |                      |                     |<--public_key--------|                    |
  |                      |                     |--save client------->|--store in DB------>|
  |                      |                     |                     |                    |
  |                      |                     |--cache public_key-->|--SET with TTL----->|
  |                      |                     |<--OK----------------|<--OK---------------|
  |                      |<--response----------|                     |                    |
  |<--{client_id,        |                     |                     |                    |
  |    public_key}-------|                     |                     |                    |

Note: 
- Security service is STATELESS (no DB persistence)
- Public key stored in Redis with TTL (X minutes, single-use)
- Private key is NOT stored (generated on-demand if needed, or discarded)
```

---

## Implementări Necesare per Serviciu

### 1. wh-svc-security (Service de Securitate - STATELESS)

> **⚠️ IMPORTANT**: Security service este **STATELESS** - nu persistă chei în baza de date. Responsabilitate exclusivă: generare chei, criptare, decriptare.

#### 1.1. Domain Layer (`domain/`)
- **Value Object**: `KeyPair` (publicKey, privateKey) - doar în memorie, nu persistat
- **Service**: `KeyGenerationService` 
  - `generateRSAKeyPair()`: generare pereche chei RSA 2048-bit (în memorie)
  - `formatPublicKeyPEM(publicKey)`: conversie la format PEM
  - `formatPrivateKeyPEM(privateKey)`: conversie la format PEM (dacă este necesar)
  - ❌ **NU există** `encryptPrivateKey()` - cheia privată nu se salvează

#### 1.2. Application Layer (`application/`)
- **Use Case**: `GenerateClientKeypairUseCase`
  - Input: `GenerateKeypairCommand` (clientId: optional)
  - Output: `KeypairResponse` (clientId, publicKey în PEM format, expiresAt)
  - **Logic** (simplificată - fără persistență): 
    1. Generate UUID pentru clientId (dacă nu e furnizat)
    2. Apel `KeyGenerationService.generateRSAKeyPair()`
    3. Format public key la PEM
    4. ❌ **NU salvează** în DB
    5. Return public key în format PEM + clientId + expiresAt

#### 1.3. ~~Persistence Layer~~ (`adapter/persistence/`)
- ❌ **ELIMINAT** - Security service nu persistă date
- ❌ **NU există** `KeyPairRepository`
- ❌ **NU există** tabelă `client_keys`

#### 1.4. REST Adapter (`adapter/rest/`)
- **Controller**: `KeyManagementController`
  - **Endpoint**: `POST /generate-keypair`
  - **Request**: `{ "client_id": "uuid" }` (optional)
  - **Response**: `{ "client_id": "uuid", "public_key": "PEM", "expires_at": "ISO8601" }`
  - **OpenAPI Documentation**: 
    - Tags: `["Key Management"]`
    - Description: "Generate RSA keypair for new client"
    - Responses: 200 (success), 500 (internal error)

#### 1.5. Configuration
- `application.properties`:
  ```properties
  # RSA key configuration
  security.rsa.key-size=2048
  security.rsa.key-expiry-minutes=10
  
  # NO DATABASE - Security service is stateless
  # NO AES encryption - private keys are not stored
  ```

---

### 2. wh-svc-manager (Service de Business Logic)

#### 2.1. Domain Layer (`domain/`)
- **Entitate**: `Client`
  - Properties: id (UUID), name (optional), email (optional), status (PENDING, ACTIVE, INACTIVE), createdAt
  - Methods: `activate()`, `deactivate()`, `isActive()`
  
- **Entitate**: `ClientRegistration`
  - Properties: id, clientId, publicKey (String - PEM format), registeredAt, expiresAt, status
  - Methods: `complete()`, `isCompleted()`, `isExpired()`

- **Value Object**: `PublicKey` (value în PEM format, expiresAt)

#### 2.2. Application Layer (`application/`)
- **Use Case**: `RegisterClientUseCase`
  - Input: `RegisterClientCommand` (name, email: optional)
  - Output: `ClientRegistrationResponse` (clientId, publicKey, expiresAt)
  - **Workflow**:
    1. Validare date input (email format dacă furnizat)
    2. Apel `SecurityServiceClient.generateKeypair()` → primește public_key (PEM)
    3. Creare entitate `Client` (status: PENDING)
    4. Creare entitate `ClientRegistration` cu **publicKey string** (nu publicKeyId)
    5. Salvare în DB PostgreSQL (transacțional)
    6. **Cache public_key în Redis** cu TTL (X minute) pentru validare single-use
    7. Update status Client la ACTIVE
    8. Return response cu client_id și public_key

#### 2.3. Port Out (`port/out/`)
- **Interface**: `SecurityServicePort`
  - `generateKeypair(clientId: UUID): KeypairResponse`

- **Interface**: `ClientRepository`
  - `save(client: Client): Client`
  - `findById(id: UUID): Optional<Client>`

- **Interface**: `ClientRegistrationRepository`
  - `save(registration: ClientRegistration): ClientRegistration`
  - `findByClientId(clientId: UUID): Optional<ClientRegistration>`

- **Interface**: `PublicKeyCache` (nou - pentru Redis)
  - `cachePublicKey(clientId: UUID, publicKey: String, ttlMinutes: int): void`
  - `getPublicKey(clientId: UUID): Optional<String>`
  - `invalidatePublicKey(clientId: UUID): void`

#### 2.4. Adapter: Feign Client (`adapter/feign/`)
- **Implementation**: `SecurityServiceFeignClient implements SecurityServicePort`
  - **Configuration**:
    ```java
    @FeignClient(
        name = "wh-svc-security",
        url = "${services.security.url}",
        configuration = SecurityServiceFeignConfig.class
    )
    public interface SecurityServiceFeignClient {
        @PostMapping("/generate-keypair")
        KeypairResponse generateKeypair(@RequestBody GenerateKeypairRequest request);
    }
    ```
  - **Config**: timeout (5s), retry (2 attempts), error decoder

#### 2.5. Adapter: Persistence (`adapter/persistence/`)
- **Repository Impl**: `ClientJpaRepository implements ClientRepository`
- **Repository Impl**: `ClientRegistrationJpaRepository implements ClientRegistrationRepository`
- **Cache Impl**: `RedisPublicKeyCache implements PublicKeyCache` (nou)
  - Folosește `StringRedisTemplate` pentru operații Redis
  - Key format: `public_key:{clientId}`
  - TTL configurat din `application.properties`
- **JPA Entities**: `ClientEntity`, `ClientRegistrationEntity`
- **Mapper**: `ClientMapper`, `ClientRegistrationMapper` (entity ↔ domain)

- **Schema DB**:
  ```sql
  CREATE TABLE clients (
      id UUID PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255),
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
  
  CREATE TABLE client_registrations (
      id UUID PRIMARY KEY,
      client_id UUID NOT NULL REFERENCES clients(id),
      public_key TEXT NOT NULL,  -- stored in PEM format
      registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      UNIQUE(client_id)
  );
  
  CREATE INDEX idx_client_email ON clients(email);
  CREATE INDEX idx_registration_client_id ON client_registrations(client_id);
  CREATE INDEX idx_registration_expires_at ON client_registrations(expires_at);
  ```

**Note**: 
- `public_key` este salvat în DB pentru audit/referință
- `public_key` este **și** cached în Redis cu TTL pentru validare single-use
- După utilizare, cheia din Redis este invalidată

#### 2.6. Port In / REST Adapter (`port/in/`, `adapter/rest/`)
- **Interface**: `RegisterClientUseCase` (port/in)
- **Controller**: `ClientRegistrationController` (adapter/rest)
  - **Endpoint**: `GET /register-client`
  - **Request**: empty (sau query params optional: name, email)
  - **Response**: 
    ```json
    {
      "client_id": "uuid",
      "public_key": "-----BEGIN PUBLIC KEY-----...",
      "expires_at": "2025-11-26T10:00:00Z"
    }
    ```
  - **Error Responses**:
    - 500: "Failed to generate keypair" (security service down)
    - 500: "Failed to register client" (DB unavailable)
  - **OpenAPI Documentation**: tags, descriptions, examples

#### 2.7. Configuration
- `application.properties`:
  ```properties
  # Security service integration
  services.security.url=http://wh-svc-security:8080
  
  # Feign client configuration
  feign.client.config.wh-svc-security.connectTimeout=5000
  feign.client.config.wh-svc-security.readTimeout=5000
  feign.client.config.wh-svc-security.loggerLevel=BASIC
  
  # Database
  spring.datasource.url=jdbc:postgresql://localhost:5432/webhooks
  spring.datasource.username=postgres
  spring.datasource.password=${DB_PASSWORD}
  spring.jpa.hibernate.ddl-auto=validate
  
  # Redis (pentru public_key cache)
  spring.redis.host=localhost
  spring.redis.port=6379
  spring.redis.database=0
  spring.redis.timeout=2000ms
  
  # Public Key TTL configuration
  webhook.public-key.ttl-minutes=10
  ```

---

### 3. wh-svc-gateway (API Gateway)

⚠️ **IMPORTANT**: Gateway va suporta validare HMAC pentru endpoints protejate, dar **NU** pentru `/register-client` (acesta este public endpoint pentru înregistrare inițială).

#### 3.1. Routing Configuration
- **Framework**: Spring Cloud Gateway
- **Route Definition**:
  ```yaml
  spring:
    cloud:
      gateway:
        routes:
          - id: register-client
            uri: http://wh-svc-manager:8080
            predicates:
              - Path=/register-client
              - Method=GET
            filters:
              - name: RequestRateLimiter
                args:
                  redis-rate-limiter.replenishRate: 10
                  redis-rate-limiter.burstCapacity: 20
              - name: CircuitBreaker
                args:
                  name: managerServiceCircuitBreaker
                  fallbackUri: forward:/fallback/register-client
              - AddRequestHeader=X-Gateway-Request, true
              - AddResponseHeader=X-Gateway-Response, true
              # NOTE: NO HMAC validation for register-client endpoint
  ```

**Note**: 
- Sistemul HMAC validation va fi implementat în viitor pentru endpoints care necesită autentificare
- `/register-client` rămâne public (rate-limited pentru protecție DDoS)

#### 3.2. Rate Limiting
- **Redis-based**: 10 requests/min per IP
- **Configuration**:
  ```properties
  spring.redis.host=localhost
  spring.redis.port=6379
  spring.data.redis.repositories.enabled=false
  ```

#### 3.3. Circuit Breaker (Resilience4j)
- **Config**:
  ```yaml
  resilience4j:
    circuitbreaker:
      instances:
        managerServiceCircuitBreaker:
          registerHealthIndicator: true
          slidingWindowSize: 10
          minimumNumberOfCalls: 5
          permittedNumberOfCallsInHalfOpenState: 3
          automaticTransitionFromOpenToHalfOpenEnabled: true
          waitDurationInOpenState: 10s
          failureRateThreshold: 50
          slowCallDurationThreshold: 5s
          slowCallRateThreshold: 50
  ```

#### 3.4. Fallback Handler
- **Controller**: `FallbackController`
  - **Endpoint**: `GET /fallback/register-client`
  - **Response**: 
    ```json
    {
      "error": "Service temporarily unavailable",
      "message": "Please try again later",
      "timestamp": "2025-10-26T10:00:00Z"
    }
    ```

#### 3.5. Monitoring & Logging
- **Actuator endpoints**: `/actuator/health`, `/actuator/circuitbreakers`
- **Logging filter**: log request/response pentru /register-client
- **Metrics**: counter pentru requests, timer pentru latency

---

## Ordine de Implementare Recomandată

### Sprint 1: Security Service (wh-svc-security) - STATELESS
1. ✅ Implement `KeyGenerationService` (RSA generation în memorie, NO DB)
2. ✅ Implement domain `KeyPair` value object
3. ✅ Implement `GenerateClientKeypairUseCase` (in-memory only)
4. ✅ Implement `KeyManagementController` (REST endpoint POST /generate-keypair)
5. ✅ Configure RSA parameters (key size: 2048, TTL: configurable)
6. ✅ Write unit tests pentru key generation
7. ✅ Write integration tests pentru endpoint (NO database tests)

### Sprint 2: Manager Service (wh-svc-manager)
1. ✅ Setup PostgreSQL schema (`clients`, `client_registrations` tables)
2. ✅ Setup Redis connection (pentru public_key cache)
3. ✅ Implement domain entities (`Client`, `ClientRegistration` cu `publicKey` string)
4. ✅ Implement `ClientRepository`, `ClientRegistrationRepository` (JPA)
5. ✅ Implement `PublicKeyCache` interface + Redis adapter
6. ✅ Implement `SecurityServiceFeignClient`
7. ✅ Implement `RegisterClientUseCase` (cu Redis caching step)
8. ✅ Implement `ClientRegistrationController` (REST endpoint GET /register-client)
9. ✅ Write unit tests pentru use case
10. ✅ Write integration tests cu mock security service
11. ✅ Write integration tests pentru Redis cache (TTL, single-use validation)

### Sprint 3: Gateway Configuration (wh-svc-gateway)
1. ✅ Configure route pentru `/register-client` (NO HMAC validation)
2. ✅ Configure rate limiter (Redis-based, 10 req/min per IP)
3. ✅ Configure circuit breaker (Resilience4j)
4. ✅ Implement fallback handler
5. ✅ Setup monitoring & logging
6. ✅ Write integration tests end-to-end
7. ✅ Document HMAC validation system (pentru viitor, nu pentru /register-client)

### Sprint 4: Integration & Documentation
1. ✅ End-to-end integration tests (toate serviciile)
2. ✅ Performance testing (load testing pentru rate limiter)
3. ✅ Redis TTL testing (verificare expirare chei după X minute)
4. ✅ Single-use validation testing (invalidare chei după utilizare)
5. ✅ Update OpenAPI documentation în toate serviciile
6. ✅ Write sequence diagram în wh-svc-docs (cu Redis și stateless security)
7. ✅ Update README-uri cu noul endpoint
8. ✅ Create Postman collection cu exemple

---

## Database Migrations

### wh-svc-security
❌ **NU sunt necesare migrații** - Security service este STATELESS, nu persistă date în baza de date.

### wh-svc-manager
```sql
-- V1__create_clients_table.sql
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    email VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED'))
);

CREATE INDEX idx_client_email ON clients(email);
CREATE INDEX idx_client_status ON clients(status);

-- V2__create_client_registrations_table.sql
CREATE TABLE client_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL,  -- PEM format, stored for audit/reference
    registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
    UNIQUE(client_id)
);

CREATE INDEX idx_registration_client_id ON client_registrations(client_id);
CREATE INDEX idx_registration_status ON client_registrations(status);
CREATE INDEX idx_registration_expires_at ON client_registrations(expires_at);
```

**Note**:
- `public_key` este salvat în DB pentru audit și referință istorică
- `public_key` activ este **și** cached în Redis cu TTL pentru validare single-use
- După utilizare, cheia din Redis este invalidată (dar rămâne în DB pentru istoric)

---

## Testing Strategy

### Unit Tests
- **Security Service**: 
  - `KeyGenerationServiceTest`: test RSA generation (in-memory, NO DB)
  - `GenerateClientKeypairUseCaseTest`: test use case logic
  - Verify public/private key pair validity
  - Verify PEM format serialization

- **Manager Service**:
  - `RegisterClientUseCaseTest`: test business logic (mocked repositories + Feign + Redis)
  - `ClientTest`: test domain entity validations
  - `ClientRegistrationTest`: test registration logic, isExpired() method
  - `RedisPublicKeyCacheTest`: test Redis cache operations (set, get, invalidate, TTL)

- **Gateway**:
  - `RateLimiterConfigTest`: test rate limiter configuration
  - `CircuitBreakerConfigTest`: test circuit breaker settings

### Integration Tests
- **Security Service**:
  - `KeyManagementControllerIntegrationTest`: 
    - Test POST /generate-keypair endpoint
    - Verify response structure (clientId, publicKey, privateKey)
    - **NO database** integration tests (service is stateless)
  
- **Manager Service**:
  - `ClientRegistrationControllerIntegrationTest`:
    - Test GET /register-client endpoint
    - Mock Feign client for security service
    - Use Testcontainers pentru PostgreSQL + Redis
    - Verify Redis cache population (public_key stored with TTL)
    - Verify single-use validation (invalidate after use)
    - Test TTL expiration (verify key disappears after X minutes)
  
- **Gateway**:
  - `RegisterClientRouteIntegrationTest`:
    - Test routing către manager service
    - Test rate limiter behavior (10 req/min)
    - Test circuit breaker (simulate manager service down)
    - Test fallback handler response
    - **NO HMAC validation** for /register-client

### End-to-End Tests
- **Full flow**: Client → Gateway → Manager → Security → Redis
- **Success scenario**: 
  - Request passes rate limiter
  - Manager calls security service successfully
  - Public key cached in Redis with TTL
  - Client receives clientId + publicKey
- **Failure scenarios**:
  - Rate limit exceeded (429 Too Many Requests)
  - Circuit breaker open (503 Service Unavailable)
  - Security service down (fallback response)
  - Redis unavailable (graceful degradation)
- **TTL expiration test**:
  - Register client
  - Wait TTL expiration
  - Verify public_key removed from Redis
  - Verify public_key still in DB (for audit)

### Performance Tests
- **Load testing**: 100 concurrent users, sustained 10 req/min per IP
- **Redis cache performance**: measure cache hit/miss rates
- **Latency benchmarks**: p50, p95, p99 response times

---

## Configuration Management

### Environment Variables
```bash
# wh-svc-security
# NO database configuration - service is stateless

# wh-svc-manager
DB_PASSWORD=<postgres-password>
SECURITY_SERVICE_URL=http://wh-svc-security:8080
REDIS_HOST=redis
REDIS_PORT=6379
PUBLIC_KEY_TTL_MINUTES=10

# wh-svc-gateway
REDIS_HOST=redis
REDIS_PORT=6379
MANAGER_SERVICE_URL=http://wh-svc-manager:8080
```

### Docker Compose (pentru development local)
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: webhooks
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7
    ports:
      - "6379:6379"
  
  wh-svc-security:
    build: ./wh-svc-security
    environment:
      # NO DATABASE - stateless service
      RSA_KEY_SIZE: 2048
    ports:
      - "8180:8080"
    # NO database dependency
  
  wh-svc-manager:
    build: ./wh-svc-manager
    environment:
      DB_PASSWORD: ${DB_PASSWORD}
      SECURITY_SERVICE_URL: http://wh-svc-security:8080
      REDIS_HOST: redis
      REDIS_PORT: 6379
      PUBLIC_KEY_TTL_MINUTES: 10
    ports:
      - "8082:8080"
    depends_on:
      - postgres
      - redis
      - wh-svc-security
  
  wh-svc-gateway:
    build: ./wh-svc-gateway
    environment:
      REDIS_HOST: redis
      MANAGER_SERVICE_URL: http://wh-svc-manager:8080
    ports:
      - "8080:8080"
    depends_on:
      - redis
      - wh-svc-manager
```

---

## Completion Checklist

- [ ] **Security Service (STATELESS)**
  - [ ] ❌ NO DB schema needed
  - [ ] RSA key generation logic implemented (in-memory)
  - [ ] REST endpoint functional (POST /generate-keypair)
  - [ ] Unit tests passing (key generation, PEM serialization)
  - [ ] Integration tests passing (endpoint only, NO DB)
  - [ ] OpenAPI documentation complete
  - [ ] Configuration: RSA key size, NO database settings

- [ ] **Manager Service**
  - [ ] DB schema created (clients, client_registrations with public_key TEXT)
  - [ ] Redis connection configured
  - [ ] Domain model implemented (Client, ClientRegistration with publicKey string)
  - [ ] Feign client configured (security service integration)
  - [ ] Redis cache adapter implemented (PublicKeyCache)
  - [ ] Use case implemented (RegisterClientUseCase with Redis caching step)
  - [ ] REST endpoint functional (GET /register-client)
  - [ ] Unit tests passing
  - [ ] Integration tests passing (PostgreSQL + Redis with Testcontainers)
  - [ ] Redis TTL tests passing (expiration validation)
  - [ ] Single-use validation tests passing (invalidate after use)
  - [ ] OpenAPI documentation complete

- [ ] **Gateway**
  - [ ] Route configured (NO HMAC validation for /register-client)
  - [ ] Rate limiter working (Redis-based, 10 req/min per IP)
  - [ ] Circuit breaker working (Resilience4j)
  - [ ] Fallback handler implemented
  - [ ] Monitoring enabled
  - [ ] HMAC validation system documented (pentru viitor)

- [ ] **Integration**
  - [ ] End-to-end tests passing (full flow: Client → Gateway → Manager → Security → Redis)
  - [ ] Performance tests passing (load testing, latency benchmarks)
  - [ ] Redis cache performance validated (hit/miss rates)
  - [ ] TTL expiration validated (keys removed from Redis after X minutes)
  - [ ] Documentation updated (wh-svc-docs cu sequence diagram updated)
  - [ ] Postman collection created
  - [ ] README-uri actualizate în toate serviciile
  - [ ] DB schema created
  - [ ] Domain model implemented
  - [ ] Feign client configured
  - [ ] Use case implemented
  - [ ] REST endpoint functional
  - [ ] Unit tests passing
  - [ ] Integration tests passing
  - [ ] OpenAPI documentation complete

- [ ] **Gateway**
  - [ ] Route configured
  - [ ] Rate limiter working
  - [ ] Circuit breaker working
  - [ ] Fallback handler implemented
  - [ ] Monitoring enabled

- [ ] **Integration**
  - [ ] End-to-end tests passing
  - [ ] Performance tests passing
  - [ ] Documentation updated (wh-svc-docs)
  - [ ] Postman collection created
  - [ ] README-uri actualizate

---

## Documentație Referință

- [Spring Cloud Gateway Docs](https://spring.io/projects/spring-cloud-gateway)
- [Resilience4j Circuit Breaker](https://resilience4j.readme.io/docs/circuitbreaker)
- [Spring Cloud OpenFeign](https://spring.io/projects/spring-cloud-openfeign)
- [Spring Data Redis](https://spring.io/projects/spring-data-redis)
- [Java RSA Cryptography](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/javax/crypto/Cipher.html)
- [SpringDoc OpenAPI](https://springdoc.org/)
- [Redis Commands Documentation](https://redis.io/commands/)
- [Testcontainers](https://testcontainers.com/)

---

**Status**: 📋 Plan actualizat - Security Service STATELESS, Redis caching pentru public_key cu TTL  
**Data**: 2025-10-26 (actualizat)  
**Estimare**: 3-4 sprints (6-8 săptămâni)

**Arhitectură Key Changes**:
- ✅ wh-svc-security: STATELESS (NO DB, in-memory key generation only)
- ✅ wh-svc-manager: Salvează `public_key` în DB + cache în Redis cu TTL pentru single-use validation
- ✅ wh-svc-gateway: NO HMAC validation pentru /register-client (HMAC system pentru viitor)
- ✅ Redis: Public key cache cu TTL configurable, invalidare după utilizare  
**Data**: 2025-10-26  
**Estimare**: 3-4 sprints (6-8 săptămâni)
