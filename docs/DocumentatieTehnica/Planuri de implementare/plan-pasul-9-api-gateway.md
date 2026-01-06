---
sidebar_position: 9
---

# Plan de Implementare - Pasul 9: API Gateway Configuration

**Data planificare**: 6 ianuarie 2026
**Status**: ✅ COMPLETED
**Dependențe**: Pașii 1-8 completați ✅

---

## Obiectiv

Configurarea API Gateway pentru a expune endpoint-ul de finalizare înrolare client (`/enroll/complete`) către exterior, asigurând rutare corectă către wh-svc-manager și aplicând politici de securitate, resilience și logging.

---

## Componente implicate

- **wh-svc-gateway**: API Gateway (Spring Cloud Gateway) - **Port 8081**
- **wh-svc-manager**: Backend service pentru enrollment - **Port 8082**
- **wh-svc-security**: Security service (indirect, apelat de manager) - **Port 8080**

---

## Arhitectură

```
Client → API Gateway (8081) → wh-svc-manager (8082) → wh-svc-security (8080)
                                     ↓
                              PostgreSQL + Redis
```

**Configurație porturilor:**
- Gateway: **8081** (punct de acces pentru clienți)
- Manager: **8082** (accesat prin Gateway)
- Security: **8080** (accesat prin Manager)

---

## Endpoint-uri de configurat

### 1. POST /enroll/complete
**Descriere**: Finalizează înrolare client (Phase 2)  
**Backend**: wh-svc-manager  
**Metode HTTP**: POST  
**Autentificare**: Nu (endpoint public pentru clienți noi)  
**Rate Limiting**: Da (previne abuse)

### 2. GET /register (Existent - pentru referință)
**Descriere**: Inițializează înrolare client (Phase 1)  
**Backend**: wh-svc-manager  
**Status**: Deja configurat ✅

---

## Configurare Spring Cloud Gateway

### application.yml - Route Configuration

```yaml
server:
  port: 8081  # Gateway port

spring:
  cloud:
    gateway:
      routes:
        # Existing route for Phase 1
        - id: manager-register
          uri: http://localhost:8082  # Direct connection to Manager
          predicates:
            - Path=/register
            - Method=GET
          filters:
            - name: CircuitBreaker
              args:
                name: managerCircuitBreaker
                fallbackUri: forward:/fallback/register
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 10
                redis-rate-limiter.burstCapacity: 20
                redis-rate-limiter.requestedTokens: 1

        # NEW: Route for Phase 2 enrollment completion
        - id: manager-enroll-complete
          uri: http://localhost:8082  # Direct connection to Manager
          predicates:
            - Path=/enroll/complete
            - Method=POST
          filters:
            - name: CircuitBreaker
              args:
                name: managerCircuitBreaker
                fallbackUri: forward:/fallback/enroll
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 5
                redis-rate-limiter.burstCapacity: 10
                redis-rate-limiter.requestedTokens: 1
            - name: Retry
              args:
                retries: 2
                statuses: INTERNAL_SERVER_ERROR,BAD_GATEWAY
                methods: POST
                backoff:
                  firstBackoff: 50ms
                  maxBackoff: 500ms
                  factor: 2
            - AddRequestHeader=X-Gateway-Route, manager-enroll-complete
            - AddRequestHeader=X-Request-Timestamp, ${timestamp}

      # Global CORS configuration
      globalcors:
        corsConfigurations:
          '[/**]':
            allowedOrigins: "*"
            allowedMethods:
              - GET
              - POST
              - OPTIONS
            allowedHeaders:
              - "*"
            maxAge: 3600

      # Circuit breaker configuration
      circuitbreaker:
        configs:
          default:
            registerHealthIndicator: true
            slidingWindowSize: 10
            minimumNumberOfCalls: 5
            permittedNumberOfCallsInHalfOpenState: 3
            automaticTransitionFromOpenToHalfOpenEnabled: true
            waitDurationInOpenState: 5s
            failureRateThreshold: 50
            eventConsumerBufferSize: 10

      # Redis rate limiter
      redis-rate-limiter:
        enabled: true
        include-headers: true
        burst-capacity-header: X-RateLimit-Burst-Capacity
        replenish-rate-header: X-RateLimit-Replenish-Rate
        remaining-header: X-RateLimit-Remaining
```

---

## Fallback Controllers

### 1. EnrollmentFallbackController.java

**Location**: `wh-svc-gateway/src/main/java/com/gateway/fallback/EnrollmentFallbackController.java`

```java
package com.gateway.fallback;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/fallback")
@Slf4j
public class EnrollmentFallbackController {

    @PostMapping("/enroll")
    public ResponseEntity<Map<String, String>> enrollFallback() {
        log.error("Enrollment service is unavailable - Circuit breaker triggered");
        return ResponseEntity
            .status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of(
                "error", "Service temporarily unavailable",
                "message", "The enrollment service is currently unavailable. Please try again later.",
                "code", "SERVICE_UNAVAILABLE"
            ));
    }
}
```

---

## Health Check Configuration

### application.yml - Actuator endpoints

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,circuitbreakers,ratelimiters
  endpoint:
    health:
      show-details: always
      probes:
        enabled: true
  health:
    circuitbreakers:
      enabled: true
    ratelimiters:
      enabled: true
```

---

## Logging Configuration

### logback-spring.xml - Add enrollment route logging

```xml
<logger name="org.springframework.cloud.gateway.filter.ratelimit" level="DEBUG"/>
<logger name="org.springframework.cloud.gateway.handler.RoutePredicateHandlerMapping" level="DEBUG"/>
<logger name="com.gateway.fallback.EnrollmentFallbackController" level="INFO"/>

<!-- Log enrollment requests -->
<logger name="reactor.netty.http.server" level="INFO"/>
```

---


## Testing Strategy

### 1. Unit Tests
- Test route predicate matching (Path, Method)
- Test filter application order
- Test fallback controller responses

### 2. Integration Tests
- Test complete flow: Gateway → Manager → Response
- Test rate limiting (exceed limits)
- Test circuit breaker (simulate manager down)
- Test retry mechanism
- Test CORS headers

### 3. Load Tests
- Concurrent requests to /enroll/complete
- Rate limiting validation
- Circuit breaker threshold validation

---

## Secvență de implementare

### Pasul 9.1: Configurare Route în Gateway ⏳
**Durată estimată**: 15 minute

1. Deschide `wh-svc-gateway/src/main/resources/application.yml`
2. Setează `server.port: 8081`
3. Adaugă route pentru `/enroll/complete` cu `uri: http://localhost:8082`
4. Configurează filtre:
   - CircuitBreaker
   - RequestRateLimiter
   - Retry
   - AddRequestHeader

**Validare**: 
```bash
# Verifică configurația este validă
cd wh-svc-gateway
mvn clean compile
```

### Pasul 9.2: Creare Fallback Controller ⏳
**Durată estimată**: 10 minute

1. Creează `EnrollmentFallbackController.java`
2. Implementează endpoint `/fallback/enroll`
3. Returnează eroare SERVICE_UNAVAILABLE cu mesaj friendly

**Validare**: Compilare fără erori

### Pasul 9.3: Configurare Health Checks ⏳
**Durată estimată**: 5 minute

1. Actualizează `management.endpoints` în application.yml
2. Enable circuit breaker și rate limiter health indicators

**Validare**:
```bash
curl http://localhost:8081/actuator/health
```

### Pasul 9.4: Configurare Logging ⏳
**Durată estimată**: 5 minute

1. Actualizează `logback-spring.xml` (dacă există)
2. Adaugă loggeri pentru gateway filters și fallback

**Validare**: Log-uri vizibile la pornirea aplicației

### Pasul 9.5: Testing End-to-End ⏳
**Durată estimată**: 20 minute

1. Pornește toate serviciile (Redis, PostgreSQL, Security, Manager, Gateway)
2. Rulează test script PowerShell prin Gateway
3. Verifică logging în Gateway
4. Testează rate limiting
5. Testează circuit breaker (oprește Manager)

**Validare**: Toate testele PASSED

### Pasul 9.6: Documentare ⏳
**Durată estimată**: 10 minute

1. Actualizează README.md al Gateway cu noul route
2. Creează IMPLEMENTATION-STEP9-SUMMARY.md
3. Actualizează CHANGELOG.md
4. Actualizează plan în `inrolare-schimbul-de-chei.md`

---

## Configurare Docker (Opțional - pentru deployment)

### docker-compose.yml

```yaml
services:
  gateway:
    build:
      context: ../wh-svc-gateway
      dockerfile: Dockerfile
    container_name: wh-gateway
    ports:
      - "8081:8081"  # Gateway port
    environment:
      - SPRING_PROFILES_ACTIVE=docker
      - SERVER_PORT=8081
      - MANAGER_SERVICE_URL=http://manager:8082
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    networks:
      - webhooks-network
    depends_on:
      - manager
      - redis
    restart: unless-stopped

  manager:
    build:
      context: ../wh-svc-manager
      dockerfile: Dockerfile
    container_name: wh-manager
    ports:
      - "8082:8082"  # Manager port
    environment:
      - SPRING_PROFILES_ACTIVE=docker
      - SERVER_PORT=8082
      - SECURITY_SERVICE_URL=http://security:8080
      - REDIS_HOST=redis
      - POSTGRES_HOST=postgres
    networks:
      - webhooks-network
    depends_on:
      - security
      - redis
      - postgres
    restart: unless-stopped
```

---

## Criterii de acceptare

✅ Gateway rutează corect `/enroll/complete` către wh-svc-manager  
✅ Rate limiting funcțional (5 req/s, burst 10)  
✅ Circuit breaker se deschide după 50% erori  
✅ Fallback controller returnează eroare friendly  
✅ Retry mechanism funcționează (2 retry-uri)  
✅ CORS configurat corect  
✅ Health checks expun starea circuit breaker și rate limiter  
✅ Logging-ul captează toate request-urile  
✅ Test PowerShell script funcționează prin Gateway  
✅ Documentație completă

---

## Riscuri și mitigări

### Risc 1: Port conflict (8081)
**Mitigare**: Verifică că niciun alt serviciu nu folosește portul 8081 pentru Gateway

### Risc 2: Rate limiting prea restrictiv
**Mitigare**: Începe cu limite generoase (5 req/s), ajustează după testare

### Risc 3: Circuit breaker se deschide prea ușor
**Mitigare**: Configurare prudentă: 50% failure rate, 10 requests sliding window

### Risc 4: Conexiune localhost în Docker
**Mitigare**: În Docker, folosește service names (manager:8082) în loc de localhost

---

## Estimare timp total

| Task | Durată |
|------|--------|
| Configurare route | 15 min |
| Fallback controller | 10 min |
| Health checks | 5 min |
| Logging | 5 min |
| Testing | 20 min |
| Documentare | 10 min |
| **TOTAL** | **65 min (~1h)** |

---

## Dependențe externe

- Redis (pentru rate limiting) - ✅ rulează în Docker
- wh-svc-manager - ✅ funcțional (rulează local pe port 8082)
- wh-svc-security - ✅ funcțional (rulează în Docker pe port 8080 si poate fi accesat local pe acelas port 8080)

**Notă**: Gateway va rula pe port 8081 și va ruta către Manager pe localhost:8082

---

## Next Steps după Pasul 9

1. ✅ **Deployment în Docker** - Containerizare completă
2. ⏳ **Monitorizare** - Grafana + Prometheus
3. ⏳ **Security hardening** - HTTPS, API keys
4. ⏳ **Performance tuning** - Load balancing, caching
5. ⏳ **Documentation** - OpenAPI aggregation la nivel Gateway

---

**Status**: Plan completat, așteptând confirmare pentru implementare

**Creat de**: GitHub Copilot  
**Data**: 6 ianuarie 2026, 14:30

