---
id: riscuri
title: Managementul Riscurilor
---

# Managementul Riscurilor - Proiect Secure WebHooks

**Ultima actualizare:** 6 februarie 2026  
**Status:** În monitorizare activă

---

## 1. Riscuri Infrastructură și Disponibilitate

### 1.1 Single Point of Failure - RabbitMQ

**Descriere:** RabbitMQ este componenta centrală pentru distribuirea mesajelor webhook. Dacă instanța unică cade, întregul sistem de messaging devine indisponibil, blocând livrarea mesajelor către toți subscriberii.

| Aspect | Valoare |
|--------|---------|
| **Probabilitate** | Medie (30-50%) |
| **Impact** | Ridicat (serviciul de messaging se oprește complet) |
| **Status actual** | ⚠️ **RISC ACTIV** - Rulează single instance în Docker |

**Măsuri de Mitigare:**

| Măsură | Status | Prioritate | Termen |
|--------|--------|-----------|---------|
| Cluster RabbitMQ HA (3+ noduri) | 📋 Planificat | Ridicată | Q2 2026 |
| Quorum queues pentru mesaje critice | 📋 Planificat | Ridicată | Q2 2026 |
| Monitoring lag cozi (alerting) | ⏳ Parțial | Medie | Q1 2026 |
| Backup periodic configurații | ❌ Neimplementat | Medie | Q2 2026 |
| Health checks avansate | ✅ Implementat | Medie | Complet |

**Plan Implementare:**
1. Setup cluster RabbitMQ cu 3 noduri (Docker Compose + K8s manifests)
2. Conversie queue-uri la quorum queues (minim 2 replici)
3. Load balancer pentru conexiuni client (HAProxy/Nginx)
4. Monitoring Prometheus pentru metrici RabbitMQ (queue depth, consumer lag)

---

### 1.2 Scalare Insuficientă la Vârf de Trafic

**Descriere:** La creșterea bruscă a numărului de mesaje (ex: Black Friday, campanii promoționale), serviciile Java și Node.js pot deveni bottleneck din cauza resurselor limitate (CPU, memorie, conexiuni DB).

| Aspect | Valoare |
|--------|---------|
| **Probabilitate** | Medie (40%) |
| **Impact** | Mediu (latențe mari, timeout-uri, dar fără pierderi date) |
| **Status actual** | ⚠️ **RISC ACTIV** - Rulează instanțe fixe fără autoscaling |

**Măsuri de Mitigare:**

| Măsură | Status | Prioritate | Termen |
|--------|--------|-----------|---------|
| Horizontal Pod Autoscaler (HPA) în K8s | 📋 Planificat | Ridicată | Q2 2026 |
| Load testing periodic (JMeter/Gatling) | 📋 Planificat | Medie | Q1 2026 |
| Connection pooling optimizat (DB, Redis) | ✅ Implementat | Ridicată | Complet |
| Rate limiting per client în Gateway | ✅ Implementat | Ridicată | Complet |
| Metrici custom pentru autoscaling | ⏳ Parțial | Medie | Q1 2026 |

**Praguri Autoscaling Planificate:**
- CPU > 70% timp de 2 minute → scale up
- Queue depth > 1000 mesaje → scale consumers
- Request rate > 100 req/sec → scale gateway

---

### 1.3 Latențe Mari în Message Delivery

**Descriere:** Timpul de la publicarea unui mesaj până la primirea lui de subscriber poate crește semnificativ din cauza: procesare criptografică intensivă, query-uri DB lente, network latency către RabbitMQ.

| Aspect | Valoare |
|--------|---------|
| **Probabilitate** | Medie (30%) |
| **Impact** | Mediu (experiență degradată, dar funcționalitate păstrată) |
| **Status actual** | ✅ **SUB CONTROL** - Latențe &lt; 500ms în medie |

**Măsuri de Mitigare:**

| Măsură | Status | Prioritate | Termen |
|--------|--------|-----------|---------|
| Caching chei criptografice în Redis | ✅ Implementat | Ridicată | Complet |
| Indexare DB pe client_id, event_id | ✅ Implementat | Ridicată | Complet |
| Connection pooling RabbitMQ | ✅ Implementat | Medie | Complet |
| Profiling APM (Application Performance Monitoring) | 📋 Planificat | Medie | Q1 2026 |
| Batching inteligent mesaje (grup publish) | 📋 Planificat | Scăzută | Q3 2026 |

**SLA Țintă:** P95 latency &lt; 300ms pentru end-to-end delivery

---

## 2. Riscuri Securitate

### 2.1 Vulnerabilități în Dependențe (CVE)

**Descriere:** Bibliotecile third-party (Spring Boot, Express, RabbitMQ client) pot conține vulnerabilități de securitate cunoscute (CVE) care expun sistemul la atacuri (ex: remote code execution, SQL injection, XSS).

| Aspect | Valoare |
|--------|---------|
| **Probabilitate** | Ridicată (60-80%) - vulnerabilități noi apar constant |
| **Impact** | Ridicat (compromitere sistem, leak date clienți) |
| **Status actual** | ⚠️ **RISC ACTIV** - Dependințe nu sunt scanate automat |

**Măsuri de Mitigare:**

| Măsură | Status | Prioritate | Termen |
|--------|--------|-----------|---------|
| Dependency scanning în CI/CD (Snyk/Dependabot) | 📋 Planificat | Ridicată | Q1 2026 |
| Update automat patch versions | 📋 Planificat | Ridicată | Q1 2026 |
| Security advisories monitoring | 📋 Planificat | Medie | Q1 2026 |
| Principle of least privilege (permisiuni minime) | ✅ Implementat | Ridicată | Complet |
| Container image scanning (Trivy/Clair) | 📋 Planificat | Medie | Q2 2026 |

**Vulnerabilități Critice Actuale:** 0 (verificat manual la 6 februarie 2026)

---

### 2.2 Exposed Secrets (Chei Criptografice, DB Passwords)

**Descriere:** Secretele (chei private, parole DB, API keys) sunt stocate în plain text în fișiere de configurație sau environment variables, expunând sistemul dacă aceste fișiere ajung pe GitHub sau sunt accesate neautorizat.

| Aspect | Valoare |
|--------|---------|
| **Probabilitate** | Medie (40%) |
| **Impact** | Ridicat (acces neautorizat la sistem, compromitere date) |
| **Status actual** | ⚠️ **RISC ACTIV** - Secrets în .env și docker-compose.yml |

**Măsuri de Mitigare:**

| Măsură | Status | Prioritate | Termen |
|--------|--------|-----------|---------|
| HashiCorp Vault pentru secrets management | 📋 Planificat | Ridicată | Q2 2026 |
| Rotație automată secrets (30-90 zile) | 📋 Planificat | Ridicată | Q2 2026 |
| .gitignore pentru fișiere sensibile | ✅ Implementat | Ridicată | Complet |
| Kubernetes Secrets (în loc de env vars) | 📋 Planificat | Medie | Q2 2026 |
| Encryption at rest pentru DB | 📋 Planificat | Medie | Q3 2026 |

**Secrete Critice în Risc:**
- Chei private clienți (stored în `client-config.json`)
- PostgreSQL root password
- Redis password
- RabbitMQ credentials

---

### 2.3 Replay Attacks

**Descriere:** Un atacator interceptează un mesaj webhook valid și îl retrimite (replay) pentru a declanșa aceeași acțiune de multiple ori (ex: procesare dublă a unei comenzi).

| Aspect | Valoare |
|--------|---------|
| **Probabilitate** | Medie (30%) |
| **Impact** | Ridicat (duplicate processing, fraude financiare) |
| **Status actual** | ⚠️ **RISC ACTIV** - Nu există protecție anti-replay |

**Măsuri de Mitigare:**

| Măsură | Status | Prioritate | Termen |
|--------|--------|-----------|---------|
| Nonce unic per mesaj (UUID) | 📋 Planificat | Ridicată | Q1 2026 |
| Timestamp validation (fereastră ±5 min) | 📋 Planificat | Ridicată | Q1 2026 |
| Redis tracking nonce-uri procesate (TTL 10 min) | 📋 Planificat | Ridicată | Q1 2026 |
| HMAC signature verification | 📋 Planificat | Medie | Q2 2026 |
| Rate limiting agresiv per client | ✅ Implementat | Medie | Complet |

**Implementare Planificată:**
```json
{
  "messageId": "uuid-unique",
  "timestamp": "2026-02-06T12:00:00Z",
  "nonce": "random-string",
  "signature": "HMAC-SHA256(payload + nonce + timestamp)"
}
```

---

## 3. Riscuri Fiabilitate Date

### 3.1 Pierderi Date la Crash

**Descriere:** La crash-ul unui serviciu în timpul procesării (ex: Node.js restart, JVM crash), mesajele în curs de procesare pot fi pierdute dacă nu sunt persistent și dacă ACK-ul este trimis prematur.

| Aspect | Valoare |
|--------|---------|
| **Probabilitate** | Scăzută (10-20%) |
| **Impact** | Ridicat (pierderi date, inconsistențe business logic) |
| **Status actual** | ✅ **SUB CONTROL** - Mecanisme de persistență implementate |

**Măsuri de Mitigare:**

| Măsură | Status | Prioritate | Termen |
|--------|--------|-----------|---------|
| RabbitMQ durable queues | ✅ Implementat | Ridicată | Complet |
| Manual ACK după procesare completă | ✅ Implementat | Ridicată | Complet |
| PostgreSQL transactions pentru operații critice | ✅ Implementat | Ridicată | Complet |
| Dead Letter Queue (DLQ) pentru mesaje failed | 📋 Planificat | Ridicată | Q1 2026 |
| Backup automat DB (zilnic) | 📋 Planificat | Medie | Q2 2026 |
| WAL archiving pentru PostgreSQL | 📋 Planificat | Medie | Q2 2026 |

**RTO (Recovery Time Objective):** &lt; 15 minute  
**RPO (Recovery Point Objective):** &lt; 5 minute (max date pierdute)

---

### 3.2 Consumatori Lenți (Slow Webhook Endpoints)

**Descriere:** Subscriberii pot avea endpoint-uri lente (>10s response time) sau pot fi offline, blocând consumer threads și acumulând mesaje în queue, afectând performanța globală a sistemului.

| Aspect | Valoare |
|--------|---------|
| **Probabilitate** | Medie (50%) |
| **Impact** | Mediu (degradare performanță, dar nu pierderi date) |
| **Status actual** | ⚠️ **RISC ACTIV** - Nu există timeout-uri stricte |

**Măsuri de Mitigare:**

| Măsură | Status | Prioritate | Termen |
|--------|--------|-----------|---------|
| HTTP timeout strict (5s) pentru delivery | 📋 Planificat | Ridicată | Q1 2026 |
| Circuit breaker per subscriber | ✅ Implementat (Gateway) | Ridicată | Complet |
| Retry cu exponential backoff (1s, 2s, 4s, 8s) | 📋 Planificat | Ridicată | Q1 2026 |
| DLQ pentru mesaje retry > 5x | 📋 Planificat | Ridicată | Q1 2026 |
| Izolare consumer pools (1 pool per subscriber) | 📋 Planificat | Medie | Q2 2026 |
| Alerting pentru consumatori lenți | 📋 Planificat | Medie | Q1 2026 |

**Strategie Retry Planificată:**
1. Tentativa 1: Imediat
2. Tentativa 2: După 10s
3. Tentativa 3: După 1 min
4. Tentativa 4: După 5 min
5. Tentativa 5: După 30 min
6. După 5 tentative → DLQ + alerting

---

## 4. Monitorizare și Alerting

### Dashboard Metrici (Planificat pentru Q1 2026)

**Metrici Cheie:**
- 📊 **Throughput:** Evenimente procesate/secundă (target: >100/s)
- ⏱️ **Latency:** P50, P95, P99 end-to-end delivery time
- ❌ **Error Rate:** % mesaje failed (target: &lt;1%)
- 📈 **Queue Depth:** Număr mesaje în așteptare (target: &lt;100)
- 🔄 **Retry Rate:** % mesaje care necesită retry
- 💀 **DLQ Size:** Mesaje în Dead Letter Queue (target: 0)

### Alerte Critice (Planificat)

| Alertă | Prag | Acțiune |
|--------|------|---------|
| RabbitMQ down | >30s downtime | PagerDuty → echipa on-call |
| Queue lag | >1000 mesaje | Scale consumers + investigare |
| Error rate | >5% | Investigare urgentă + rollback |
| DLQ size | >10 mesaje | Analiză root cause |
| CPU > 90% | >5 min | Autoscaling trigger |
| Disk usage | >85% | Cleanup logs + alerting |

### Audit Securitate

**Frecvență:** Trimestrial (Q1, Q2, Q3, Q4)

**Checklist:**
- ✅ Review access logs pentru activități suspecte
- ✅ Scan vulnerabilități dependințe (Snyk/OWASP)
- ✅ Review permisiuni utilizatori/servicii
- ✅ Test penetrare basic (OWASP Top 10)
- ✅ Verificare rotație secrets (când va fi implementat)

---

## 5. Rezumat Matrice Riscuri

| Risc | Probabilitate | Impact | Status | Prioritate |
|------|---------------|--------|--------|-----------|
| RabbitMQ SPOF | Medie | Ridicat | ⚠️ Activ | 🔴 Ridicată |
| Vulnerabilități CVE | Ridicată | Ridicat | ⚠️ Activ | 🔴 Ridicată |
| Exposed Secrets | Medie | Ridicat | ⚠️ Activ | 🔴 Ridicată |
| Replay Attacks | Medie | Ridicat | ⚠️ Activ | 🔴 Ridicată |
| Consumatori Lenți | Medie | Mediu | ⚠️ Activ | 🟡 Medie |
| Scalare Insuficientă | Medie | Mediu | ⚠️ Activ | 🟡 Medie |
| Pierderi Date | Scăzută | Ridicat | ✅ Control | 🟢 Scăzută |
| Latențe Mari | Medie | Mediu | ✅ Control | 🟢 Scăzută |

---

## 6. Plan de Acțiune Prioritar

### Sprint Q1 2026 (Următoarele 4 săptămâni)

**Must-Have (P0):**
1. ✅ Implementare Dead Letter Queue (DLQ)
2. ✅ Retry logic cu exponential backoff
3. ✅ Dependency scanning în CI/CD
4. ✅ Anti-replay protection (nonce + timestamp)

**Should-Have (P1):**
5. ✅ Prometheus + Grafana setup
6. ✅ Alerting pentru metrici critice
7. ✅ Load testing basic (500 req/s)

**Nice-to-Have (P2):**
8. Documentație runbook pentru incidente
9. Disaster recovery testing

---

**Ultima revizie:** 6 februarie 2026  
**Responsabil:** Engineering Team  
**Next Review:** 6 martie 2026
