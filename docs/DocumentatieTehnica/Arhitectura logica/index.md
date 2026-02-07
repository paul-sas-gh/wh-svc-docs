# Index Diagrame Arhitectură Logică

**Ultima actualizare:** 7 februarie 2026  
**Scop:** Ghid navigare pentru toate diagramele tehnice ale proiectului

---

## 📊 Diagrame Disponibile

### 1. [Arhitectură Servicii (Implementare Reală)](./diagrama-arhitectura-servicii.md)

**Status:** ✅ Implementat  
**Conținut:**
- Diagrama completă a tuturor componentelor sistem
- Layere: Client, Gateway, Business Logic, Infrastructure
- Conexiuni și protocoale (HTTP REST, WebSocket, AMQP)
- Arhitectură RabbitMQ detaliată (Topic Exchange + Routing)
- Diferențe arhitectură planificată vs implementată

**Când să folosești:**
- Onboarding noi dezvoltatori
- Prezentări tehnice pentru management
- Planning scalare infrastructură
- Debugging probleme de comunicare între servicii

---

### 2. [Flux End-to-End Publicare Mesaj](./diagrama-flux-end-to-end.md)

**Status:** ✅ Implementat  
**Conținut:**
- Sequence diagram complet: Publisher → Subscriber
- Pași de criptare/decriptare la fiecare nivel
- Timpii de răspuns pentru fiecare componentă
- Error handling și retry logic
- Metrici de performanță

**Când să folosești:**
- Înțelegerea fluxului complet de date
- Debugging mesaje care nu ajung la destinație
- Optimizare latență end-to-end
- Explicare flux pentru stakeholders

---

### 3. [Flux Enrollment Client (2-Phase)](./diagrama-flux-enrollment.md)

**Status:** ✅ Implementat  
**Conținut:**
- Enrollment în 2 faze cu schimb de chei
- Generare și stocare chei criptografice
- Validări și securitate la fiecare pas
- Timeouts și TTLs
- Error handling pentru scenarii comune

**Când să folosești:**
- Onboarding noi clienți în sistem
- Debugging probleme de înregistrare
- Explicare proces de securitate
- Testing enrollment flow

---

## 🎯 Ghid Rapid de Utilizare

### Pentru Dezvoltatori Noi

**Pas 1:** Citește [Arhitectura Servicii](./diagrama-arhitectura-servicii.md) pentru overview general

**Pas 2:** Studiază [Flux Enrollment](./diagrama-flux-enrollment.md) pentru înțelegerea setup-ului inițial

**Pas 3:** Parcurge [Flux End-to-End](./diagrama-flux-end-to-end.md) pentru funcționalitatea core

### Pentru Debugging

**Problemă: Client nu se poate înregistra**
→ Vezi [Flux Enrollment](./diagrama-flux-enrollment.md) - secțiunea Error Handling

**Problemă: Mesaje nu ajung la subscriberi**
→ Vezi [Flux End-to-End](./diagrama-flux-end-to-end.md) - secțiunea Retry și Error Handling

**Problemă: Latențe mari**
→ Vezi [Arhitectura Servicii](./diagrama-arhitectura-servicii.md) - secțiunea Metrici

### Pentru Optimizare

**Target: Reducere latență**
→ Studiază [Flux End-to-End](./diagrama-flux-end-to-end.md) pentru identificarea bottleneck-urilor

**Target: Creștere throughput**
→ Vezi [Arhitectura Servicii](./diagrama-arhitectura-servicii.md) - secțiunea RabbitMQ pentru scaling

**Target: Îmbunătățire securitate**
→ Vezi [Flux Enrollment](./diagrama-flux-enrollment.md) pentru best practices

---

## 📈 Evoluția Arhitecturii

### Februarie 2026 (Actual)
- ✅ Arhitectură microservicii cu 4 servicii Java/Node.js
- ✅ RabbitMQ Topic Exchange pentru messaging
- ✅ Socket.IO pentru real-time delivery
- ✅ Criptare end-to-end RSA + AES

### Q1 2026 (Planificat)
- 📋 Prometheus + Grafana pentru observabilitate
- 📋 Dead Letter Queue pentru mesaje failed
- 📋 Retry logic avansat cu exponential backoff

### Q2 2026 (Roadmap)
- 📋 Kubernetes orchestration
- 📋 RabbitMQ Cluster HA
- 📋 ELK Stack pentru logging centralizat
- 📋 OpenTelemetry distributed tracing

---

## 🔗 Linkuri Utile

**Documentație Tehnică:**
- [Plan Arhitectură](../../PlanDeProiect/arhitectura.md)
- [Obiective Proiect](../../PlanDeProiect/obiective.md)
- [Tehnologii Utilizate](../../PlanDeProiect/tehnologii.md)

**Rapoarte Implementare:**
- [Message Distribution Workflow](../Rapoarte%20de%20implementare/Workflows/Message-Distribution/)
- [Client Enrollment Workflow](../Rapoarte%20de%20implementare/Workflows/Inrolare%20Client%20-%20Schimb%20de%20chei/)

**Cod Sursă:**
- [wh-svc-gateway](../../../../wh-svc-gateway/)
- [wh-svc-manager](../../../../wh-svc-manager/)
- [wh-svc-security](../../../../wh-svc-security/)
- [wh-client](../../../../wh-client/)

---

## 💡 Sfaturi

### Pentru Citire Eficientă

1. **Folosește Mermaid Live Editor** pentru diagrame interactive:
   - https://mermaid.live/
   - Copy-paste codul Mermaid din documentație
   - Zoom și explorare interactivă

2. **Parcurge în ordine:**
   - Overview (Arhitectură Servicii)
   - Setup (Flux Enrollment)
   - Core Flow (Flux End-to-End)

3. **Focus pe sectorul relevant:**
   - Backend developer → Secțiuni Business Logic
   - Frontend developer → Secțiuni Client Layer
   - DevOps → Secțiuni Infrastructure

### Pentru Contribuție

Când adaugi noi diagrame:
1. Urmărește template-ul existent (format Mermaid + explicații)
2. Adaugă secțiuni: Status, Componente, Metrici, Error Handling
3. Include exemple de teste și debugging
4. Update acest index

---

**Menținut de:** Engineering Team  
**Feedback:** Pentru sugestii de îmbunătățire diagrame, creați issue în repo  
**Tool-uri recomandate:** Mermaid Live Editor, Draw.io, IntelliJ Diagrams
