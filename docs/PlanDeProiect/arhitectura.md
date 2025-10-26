---
id: plan-arhitectura
title: Arhitectura servicii

---

Arhitectură bazată pe microservicii pentru decuplare, scalabilitate și izolare a responsabilităților.

Componentă principală:

1. API Gateway (Spring Cloud Gateway)
   - Autentificare & autorizare
   - Rate limiting & circuit breakers
   - Routing centralizat
2. Webhook Management Service
   - CRUD subscripții
   - Validare endpoint + stocare secret
   - Exporte configurări
3. Event Ingestion Service
   - Expune endpoint securizat de primire evenimente
   - Enrich + validare payload
   - Publicare în RabbitMQ (exchange topic)
4. Event Dispatcher (Workers)
   - Consumă mesaje (queues per event type)
   - Calculează semnătură HMAC
   - Trimite HTTP webhook (WebClient non-blocking)
   - Retries + backoff + DLQ
5. Notification Service (opțional)
   - Alerte eșec livrare persistentă (email / webhook intern)
6. Observability Stack
   - Prometheus + Grafana (metrici)
   - ELK (loguri structurate + corelare)
   - Tracing (OpenTelemetry) – distribuție latențe

Flux principal:

Client Eveniment -> Gateway -> Ingestion Service -> RabbitMQ -> Dispatcher -> Subscriber Endpoint

Securitate în tranzit: TLS terminat la Gateway; semnătură HMAC + nonce + timestamp în headere.