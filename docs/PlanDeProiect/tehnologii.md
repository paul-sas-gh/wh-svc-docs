---
id: tehnologii
title: Tehnologii Utilizate și Planificate
sidebar_position: 2
---

# Stack Tehnologic - Proiect Secure WebHooks

**Ultima actualizare:** 6 februarie 2026

---

## 1. Backend Services (✅ Implementat)

### 1.1 Java Microservices

| Tehnologie | Versiune | Rol | Status |
|------------|----------|-----|--------|
| **Java** | 21 LTS | Limbaj principal backend, matur, ecosistem bogat | ✅ Activ |
| **Spring Boot** | 3.3.x | Framework microservicii, configurare automată | ✅ Activ |
| **Spring WebFlux** | 6.x | Reactive programming pentru I/O non-blocking | ⏳ Parțial (Gateway folosește, Manager nu) |
| **Spring Cloud Gateway** | 4.x | API Gateway: routing, rate limiting, circuit breakers | ✅ Activ |
| **Spring Data JPA** | 3.x | ORM pentru PostgreSQL, repository pattern | ✅ Activ |
| **Resilience4j** | 2.x | Circuit breakers, retry, rate limiter | ✅ Activ |
| **Flyway** | 9.x | Database migration și version control | ✅ Activ |

**Use Cases:**
- `wh-svc-security`: Servicii criptografice (RSA + AES-GCM)
- `wh-svc-manager`: Business logic core (subscripții, evenimente, messaging)
- `wh-svc-gateway`: Entry point cu autentificare și protecție

---

### 1.2 Node.js BFF (Backend for Frontend)

| Tehnologie | Versiune | Rol | Status |
|------------|----------|-----|--------|
| **Node.js** | 22.x LTS | Runtime JavaScript server-side | ✅ Activ |
| **Express.js** | 4.x | Web framework pentru REST API | ✅ Activ |
| **Socket.IO** | 4.x | WebSocket real-time communication | ✅ Activ |
| **amqplib** | 0.10.x | RabbitMQ client pentru Node.js | ✅ Activ |
| **Axios** | 1.x | HTTP client pentru apeluri către Java services | ✅ Activ |
| **dotenv** | 16.x | Environment variables management | ✅ Activ |

**Use Case:**
- `wh-client-backend`: Proxy către Java services + RabbitMQ consumer + Socket.IO server

---

## 2. Frontend (✅ Implementat)

| Tehnologie | Versiune | Rol | Status |
|------------|----------|-----|--------|
| **React** | 19.x | UI framework, component-based architecture | ✅ Activ |
| **Vite** | 5.x | Build tool ultra-rapid, HMR | ✅ Activ |
| **Material-UI (MUI)** | 6.x | Component library pentru UI profesional | ✅ Activ |
| **Tremor** | 3.x | Dashboard components și data visualization | ✅ Activ |
| **Socket.IO Client** | 4.x | WebSocket client pentru real-time updates | ✅ Activ |
| **React Router** | 6.x | Routing SPA | ✅ Activ |
| **Notistack** | 3.x | Toast notifications | ✅ Activ |
| **Tailwind CSS** | 3.x | Utility-first CSS framework | ✅ Activ |

**Features Implementate:**
- Dashboard cu statistici
- Management evenimente și subscripții
- Chat real-time pentru webhook messages
- Configurație dinamică backend URL

---

## 3. Persistență și Caching (✅ Implementat)

| Tehnologie | Versiune | Rol | Status |
|------------|----------|-----|--------|
| **PostgreSQL** | 16.x | Database relațională pentru date persistente | ✅ Activ |
| **Redis** | 7.x | Cache în memorie pentru chei criptografice | ✅ Activ |
| **Flyway** | 9.x | Schema migration și versioning | ✅ Activ |

**Date Stocate:**

**PostgreSQL:**
- Clienți înregistrați (chei publice/private)
- Event types (evenimente publicate de clienți)
- Subscripții (legături subscriber → publisher)
- Temporary keys (pentru enrollment 2-phase)

**Redis:**
- Cache chei criptografice (TTL configurabil)
- Rate limiting counters
- Session data (planificat)

---

## 4. Messaging și Event Streaming (✅ Implementat)

| Tehnologie | Versiune | Rol | Status |
|------------|----------|-----|--------|
| **RabbitMQ** | 3.13.x | Message broker pentru distribuire webhooks | ✅ Activ |
| **AMQP Protocol** | 0.9.1 | Protocol standard pentru messaging | ✅ Activ |

**Arhitectură RabbitMQ:**
- **Exchange:** `webhook.events` (Topic Exchange)
- **Routing Key Pattern:** `webhook.client.{clientId}`
- **Queue Naming:** `queue.client.{clientId}`
- **Durability:** Toate queue-urile sunt durable
- **ACK Mode:** Manual ACK pentru reliability

**Planificat Q2 2026:**
- Cluster RabbitMQ HA (3 noduri)
- Quorum queues pentru high availability
- Dead Letter Queues (DLQ) pentru failed messages

---

## 5. Containerizare și Orchestrare (✅ Parțial Implementat)

| Tehnologie | Versiune | Rol | Status |
|------------|----------|-----|--------|
| **Docker** | 24.x | Containerizare servicii pentru medii consistente | ✅ Activ |
| **Docker Compose** | 2.x | Orchestrare locală multi-container | ✅ Activ |
| **Kubernetes** | 1.28+ | Orchestrare producție, autoscaling, resilience | 📋 Planificat Q2 2026 |
| **Helm** | 3.x | Package manager Kubernetes | 📋 Planificat Q2 2026 |

**Status Actual:**
- ✅ Toate serviciile sunt containerizate
- ✅ `docker-compose.yml` funcțional pentru development
- ✅ Health checks implementate în toate containerele
- 📋 K8s manifests în lucru pentru Q2 2026

**Containere Active:**
- `wh-svc-security` (Java, port 8080)
- `wh-svc-manager` (Java, port 8082)
- `wh-svc-gateway` (Java, port 8081)
- `wh-client1` (Node.js + React, ports 3001/5171)
- `wh-client2` (Node.js + React, ports 3002/5172)
- `wh-postgres` (PostgreSQL, port 5432)
- `wh-redis` (Redis, port 6379)
- `wh-rabbitmq` (RabbitMQ, ports 5672/15672)

---

## 6. Observabilitate și Monitoring (⏳ Parțial Implementat)

### 6.1 Metrici și Monitoring

| Tehnologie | Versiune | Rol | Status |
|------------|----------|-----|--------|
| **Spring Actuator** | 3.x | Health checks și metrici pentru Java services | ✅ Activ |
| **Micrometer** | 1.x | Abstracție pentru metrici (compatible Prometheus) | ✅ Activ |
| **Prometheus** | 2.x | Colectare și stocare time-series metrici | 📋 Planificat Q1 2026 |
| **Grafana** | 10.x | Dashboard-uri și vizualizare metrici | 📋 Planificat Q1 2026 |

**Endpoints Actuator Active:**
- `/actuator/health` - Status serviciu și dependințe
- `/actuator/info` - Informații aplicație
- `/actuator/metrics` - Metrici custom și standard
- `/actuator/prometheus` - Export format Prometheus

---

### 6.2 Logging și Analiza

| Tehnologie | Versiune | Rol | Status |
|------------|----------|-----|--------|
| **SLF4J + Logback** | 2.x | Logging framework Java | ✅ Activ |
| **Console Logging** | - | Logging structured pentru Node.js | ✅ Activ |
| **ELK Stack** | 8.x | Centralizare și analiza loguri | 📋 Planificat Q2 2026 |
| - Elasticsearch | 8.x | Stocare și indexare loguri | 📋 Planificat |
| - Logstash | 8.x | Procesare și transport loguri | 📋 Planificat |
| - Kibana | 8.x | Vizualizare și query loguri | 📋 Planificat |

**Format Logging Actual:**
- Structured logging cu context (clientId, eventId, timestamp)
- Log levels: TRACE, DEBUG, INFO, WARN, ERROR
- Categorii: `[GATEWAY]`, `[SECURITY]`, `[RABBITMQ]`, `[WEBSOCKET]`, etc.

---

### 6.3 Distributed Tracing

| Tehnologie | Versiune | Rol | Status |
|------------|----------|-----|--------|
| **OpenTelemetry** | 1.x | Standard tracing distribuit | 📋 Planificat Q2 2026 |
| **Jaeger** sau **Zipkin** | Latest | Backend tracing și vizualizare | 📋 Planificat Q2 2026 |

---

## 7. Securitate (✅ Implementat + 📋 Planificat)

### 7.1 Criptografie

| Tehnologie | Versiune | Rol | Status |
|------------|----------|-----|--------|
| **Java Cryptography Extension (JCE)** | - | Implementare RSA + AES | ✅ Activ |
| **RSA-2048** | - | Criptare asimetrică pentru chei | ✅ Activ |
| **AES-256-GCM** | - | Criptare simetrică pentru payload-uri | ✅ Activ |
| **BCrypt** | - | Hashing parole (când va fi implementat auth) | 📋 Planificat |

**Algoritmi Implementați:**
- RSA/ECB/OAEPWithSHA-256AndMGF1Padding
- AES/GCM/NoPadding (256-bit key, 128-bit tag)
- Hibrid: AES pentru date + RSA pentru cheia AES

---

### 7.2 Secrets Management

| Tehnologie | Versiune | Rol | Status |
|------------|----------|-----|--------|
| **.env files** | - | Configurație locală (development) | ✅ Activ |
| **.gitignore** | - | Protecție împotriva commit-urilor accidentale | ✅ Activ |
| **HashiCorp Vault** | 1.x | Secrets management centralizat | 📋 Planificat Q2 2026 |
| **Kubernetes Secrets** | - | Secrets în cluster K8s | 📋 Planificat Q2 2026 |

---

### 7.3 Security Scanning

| Tehnologie | Versiune | Rol | Status |
|------------|----------|-----|--------|
| **Snyk** sau **Dependabot** | - | Dependency vulnerability scanning | 📋 Planificat Q1 2026 |
| **Trivy** sau **Clair** | - | Container image scanning | 📋 Planificat Q2 2026 |
| **OWASP Dependency Check** | - | Security audit pentru dependințe Java | 📋 Planificat Q1 2026 |
| **SonarQube** | 10.x | Code quality și security analysis | 📋 Planificat Q2 2026 |

---

## 8. CI/CD și DevOps (📋 Planificat)

| Tehnologie | Versiune | Rol | Status |
|------------|----------|-----|--------|
| **GitHub Actions** | - | CI/CD automation (build, test, deploy) | 📋 Planificat Q1 2026 |
| **Jenkins** | 2.x | Alternative CI/CD (dacă se preferă) | 📋 Opțional |
| **Maven** | 3.9.x | Build tool Java (wrapper inclus) | ✅ Activ |
| **npm** | 10.x | Package manager Node.js/React | ✅ Activ |

**Pipeline Planificat:**
1. **Build Stage:** Compile Java + Bundle React
2. **Test Stage:** Unit tests + Integration tests
3. **Security Stage:** Dependency scan + SAST
4. **Docker Stage:** Build images + Push to registry
5. **Deploy Stage:** Deploy to K8s cluster

---

## 9. Testing (⏳ Parțial Implementat)

| Tehnologie | Versiune | Rol | Status |
|------------|----------|-----|--------|
| **JUnit 5** | 5.10.x | Unit testing framework Java | ✅ Activ |
| **Mockito** | 5.x | Mocking framework pentru teste Java | ✅ Activ |
| **Testcontainers** | 1.19.x | Integration testing cu Docker containers | ✅ Activ |
| **Spring Boot Test** | 3.x | Testing utilities Spring | ✅ Activ |
| **Jest** sau **Vitest** | Latest | Unit testing framework JavaScript | 📋 Planificat Q1 2026 |
| **React Testing Library** | Latest | Component testing React | 📋 Planificat Q1 2026 |
| **JMeter** sau **Gatling** | Latest | Load testing și performance | 📋 Planificat Q1 2026 |

**Coverage Actual:**
- Java services: ~70% unit test coverage
- Integration tests pentru enrollment flow
- E2E tests: Manual (automation planificată)

---

## 10. Documentație (✅ Implementat)

| Tehnologie | Versiune | Rol | Status |
|------------|----------|-----|--------|
| **Docusaurus** | 3.x | Documentație tehnică statică | ✅ Activ |
| **Markdown** | - | Format documentație | ✅ Activ |
| **Swagger/OpenAPI** | 3.0 | Documentație API REST | ✅ Activ |
| **JSDoc** | - | Documentație cod JavaScript | ✅ Activ |
| **JavaDoc** | - | Documentație cod Java | ✅ Activ |

**Site Docusaurus:** http://localhost:3000 (development)

---

## 11. Utilități și Tools

| Tehnologie | Versiune | Rol | Status |
|------------|----------|-----|--------|
| **PowerShell** | 7.x | Management scripts Windows | ✅ Activ |
| **Bash** | - | Management scripts Linux/Mac | ✅ Activ |
| **cURL** | - | Testing API endpoints | ✅ Activ |
| **Postman** | Latest | API testing și development | ✅ Folosit |
| **IntelliJ IDEA** | 2024.x | IDE principal Java | ✅ Folosit |
| **VS Code** | Latest | Editor pentru Node.js/React | ✅ Folosit |

---

## 12. Rezumat Status Tehnologii

### ✅ Implementat și Activ (Core Stack)
- Java 21 + Spring Boot 3.x
- Node.js 22 + Express.js + Socket.IO
- React 19 + Vite + Material-UI
- PostgreSQL 16 + Redis 7
- RabbitMQ 3.13
- Docker + Docker Compose
- Spring Cloud Gateway + Resilience4j

### ⏳ Parțial Implementat
- Spring WebFlux (doar în Gateway)
- Observabilitate (health checks + basic logging)
- Testing (unit tests, dar nu E2E automation)

### 📋 Planificat Q1 2026
- Prometheus + Grafana
- Dependency scanning (Snyk/Dependabot)
- GitHub Actions CI/CD
- Jest/Vitest pentru frontend
- Load testing (JMeter)

### 📋 Planificat Q2 2026
- Kubernetes + Helm
- ELK Stack (Elasticsearch, Logstash, Kibana)
- OpenTelemetry + Jaeger
- HashiCorp Vault
- RabbitMQ Cluster HA
- SonarQube

---

## 13. Decizii Tehnice Importante

### De ce Spring Boot și nu Spring WebFlux peste tot?
- **Spring Boot (blocking):** Pentru `wh-svc-manager` unde logica business este predominant CPU-bound (criptare/decriptare)
- **Spring WebFlux (reactive):** Pentru `wh-svc-gateway` unde avem multe conexiuni concurrent și I/O-bound operations

### De ce Node.js pentru client backend?
- Ecosistem bogat pentru WebSocket (Socket.IO)
- Integrare ușoară cu RabbitMQ (amqplib)
- Dezvoltare rapidă pentru BFF pattern
- Echipa frontend poate contribui la backend

### De ce RabbitMQ și nu Kafka?
- Setup mai simplu pentru use case-ul nostru
- Topic exchange perfect pentru routing per client
- Community și documentație excelentă
- Overhead mai mic pentru volume medii de mesaje

### De ce React 19 și nu Angular/Vue?
- Ecosistem matur și vast
- Material-UI oferă componente profesionale out-of-the-box
- Vite oferă developer experience excelent
- Socket.IO client are suport first-class

---

**Ultima actualizare:** 6 februarie 2026  
**Responsabil:** Engineering Team  
**Next Review:** Lunar (prima săptămână a lunii)
