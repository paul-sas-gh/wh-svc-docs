# Plan de Implementare: Webhook Messaging via RabbitMQ

Acest document descrie arhitectura și pașii necesari pentru a livra mesajele webhook de la `wh-svc-manager` către `wh-client-backend` utilizând RabbitMQ, asigurând securitatea datelor prin criptare.

## 1. Arhitectura Fluxului de Date

Fluxul propus evită polling-ul și gateway-ul HTTP pentru livrarea mesajelor, oferind o soluție event-driven (push) performantă.

```mermaid
sequenceDiagram
    participant P as Publisher (Client A)
    participant M as wh-svc-manager
    participant RMQ as RabbitMQ
    participant C as wh-client-backend (Client B)
    participant FE as Frontend React (Client B)

    P->>M: POST Event Encrypted
    Note over M: 1. Decriptare (Sender Public Key)
    Note over M: 2. Identificare Subscribers (Client B)
    Note over M: 3. Transformare Mesaj
    Note over M: 4. Criptare Payload (Client B System Private Key)
    M->>RMQ: Publish (Exchange: wh.events)
    Note right of M: RoutingKey: webhook.client.{clientB_ID}
    RMQ->>C: Consume Message
    Note over C: 1. Decriptare (Client B system public Key)
    C->>FE: WebSocket Emit (event_received)
```

### 🔐 Notă Critică despre Criptare
În cerință s-a menționat criptarea cu "cheia privată a sistemului".
**Corecție de Securitate:** Criptarea cu o cheie privată este tehnic o **semnătură** (oricine are cheia publică o poate decripta), deci nu oferă confidențialitate.
**Soluție:** `wh-svc-manager` va cripta mesajul folosind **Cheia Publică a Clientului Destinatar** (preluată din DB/Redis). Astfel, doar Clientul B (care are cheia sa privată în `client-config.json`) va putea decripta mesajul.

---

## 2. Modificări Necesare în Componente

### A. `wh-svc-manager` (Java - Publisher)

1.  **Dependențe:** Adăugare `spring-boot-starter-amqp`.
2.  **Configurare RabbitMQ:**
    *   Exchange: `webhook.events` (Topic Exchange).
    *   Queue: Nu declară cozi specifice clienților (asta e responsabilitatea clientului).
3.  **Serviciu de Livrare (`MessageDeliveryService`):**
    *   Input: `DecryptedEvent` + Lista `Subscribers`.
    *   Loop prin fiecare subscriber.
    *   Lookup cheie publică subscriber (din DB/Redis).
    *   Encrypt payload: `{ eventId, sender, message }`.
    *   Structură Mesaj RMQ: `{ clientId: "...", encryptedData: "..." }`.
    *   Publish cu Routing Key: `webhook.client.{subscriberId}`.

### B. `wh-client-backend` (Node.js - Consumer)

#### Fluxul de Inițializare și Consum (Diagramă Secvență)

```mermaid
sequenceDiagram
    participant Node as wh-client-backend
    participant RMQ as RabbitMQ Service

    Note over Node: Start Application
    Node->>RMQ: Connect (amqp://...)
    Node->>RMQ: createChannel()
    Node->>RMQ: assertExchange('webhook.events', 'topic')
    Note right of Node: Queue Name: queue.client.{myClientId}
    Node->>RMQ: assertQueue(queueName, {durable: true, exclusive: false})
    Note right of Node: Routing Key: webhook.client.{myClientId}
    Node->>RMQ: bindQueue(queueName, exchange, routingKey)
    Node->>RMQ: consume(queueName)
    loop Async Message Handling
        RMQ-->>Node: Message {clientId, encryptedData}
        Node->>Node: Decrypt & Emit to FE
        Node->>RMQ: ack(message)
    end
```

1.  **Dependențe:** Adăugare `amqplib`.
2.  **Serviciu RabbitMQ (`rabbitmqService.js`):**
    *   Conectare la start-up (retry logic).
    *   Assert Queue: `queue.client.{myClientId}` (Durable, Exclusive: false).
    *   Bind Queue la Exchange `webhook.events` cu Routing Key `webhook.client.{myClientId}`.
    *   Consume:
        *   Primire mesaj `{ clientId, encryptedData }`.
        *   Decriptare cu `securityService.decrypt()` (folosind cheia privată locală).
        *   Emitere pe Socket.IO către Frontend.

### C. Infrastructură (Docker)

*   **Service Name:** `wh-rabbitmq`
*   **Port:** 5672 (AMQP)
*   **Management Interface:** http://localhost:15672
*   **Credentials:**
    *   User: `webhooks_user`
    *   Pass: `webhooks_pass`
*   **Network:** `webhooks-network` (accesibil pentru `wh-svc-manager` și `wh-client1/2`).

**Configurare Mediu Local (`.env` pentru Client):**
```env
RABBITMQ_URL=amqp://webhooks_user:webhooks_pass@localhost:5672
RABBITMQ_EXCHANGE=webhook.events
```

**Configurare Mediu Docker (`docker-compose.yml`):**
```yaml
environment:
  - RABBITMQ_URL=amqp://webhooks_user:webhooks_pass@wh-rabbitmq:5672
  - RABBITMQ_EXCHANGE=webhook.events
depends_on:
  - wh-rabbitmq
```

**Notă Importantă:** În Docker se folosește numele containerului (`wh-rabbitmq`) în loc de `localhost`.

---

## 3. Plan Detaliat de Implementare

### Etapa 1: Backend Node.js (Consumer)
Deoarece managerul nu trimite încă nimic, începem cu pregătirea clientului pentru a asculta.
1.  Instalare `amqplib`.
2.  Implementare `rabbitmqService.js`.
3.  Integrare în `index.js`.

### Etapa 2: Manager Service (Publisher)
1.  Adăugare dependențe Maven.
2.  Configurare conexiune RabbitMQ (`application.properties`).
3.  Implementare logică de criptare și publicare.

### Etapa 3: Testare End-to-End
1.  Publicare eveniment de pe Client A.
2.  Verificare log-uri Manager (procesare + publicare RMQ).
3.  Verificare log-uri Client B (recepție RMQ + decriptare).
4.  Validare afișare în UI Client B.

---

## 4. Structura Datelor

**Mesaj Decriptat (Procesat de Manager):**
```json
{
  "eventName": "order.created",
  "eventId": "uuid-event",
  "sender": "Client A",
  "message": "Ordin #123 creat"
}
```

**Mesaj Criptat (Trimis pe RabbitMQ):**
```json
{
  "clientId": "client-b-uuid",
  "encryptedData": "BASE64_CIPHERTEXT..."
}
```
*Notă: `encryptedData` este rezultatul criptării JSON-ului de mai sus cu Public Key a Clientului B.*
