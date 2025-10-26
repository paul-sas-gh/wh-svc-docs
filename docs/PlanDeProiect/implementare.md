---
id: implementare
title: Plan de Implementare pe Faze
---

Faza 1: Setup & Fundament
- Repo multi-modul (Gradle/Maven)
- Docker Compose: PostgreSQL, Redis, RabbitMQ
- Pipeline CI: build + unit tests + lint + scan dependențe

Faza 2: Servicii de Bază
- Webhook Management Service (CRUD, validare endpoint)
- Event Ingestion Service (endpoint securizat)
- Integrare RabbitMQ (exchanges + queues)
- Dispatcher skeleton (log consum eveniment)

Faza 3: Livrare & Reziliență
- HTTP dispatch non-blocking (WebClient)
- Retries exponencial backoff (Spring Retry)
- DLQ configurat
- Logging structurat (correlation id/event id)

Faza 4: Securitate Avansată
- HMAC signature header
- Anti-replay (timestamp + nonce în Redis)
- Vault integration pentru secrets
- Rate limiting / circuit breaker (Resilience4j)

Faza 5: Testare & Observabilitate
- Testcontainers integrare
- Metrici (Actuator + Micrometer)
- Dashboard Grafana
- Log centralization (ELK)
- K8s manifests (Deployment, Service, Ingress)

Faza 6: Documentație & Mentenanță
- OpenAPI (springdoc)
- Ghid subscriber securizare endpoint
- Plan upgrade & rotație secrete