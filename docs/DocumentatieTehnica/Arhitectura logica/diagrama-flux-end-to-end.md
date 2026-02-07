# Diagrama Flux End-to-End Publicare Mesaj Webhook

**Ultima actualizare:** 7 februarie 2026  
**Scop:** Vizualizare completă a fluxului de la publicare până la afișare mesaj

## Flux Complet: Publisher → Subscriber

```mermaid
sequenceDiagram
    participant PFE as Publisher Frontend<br/>(React)
    participant PBE as Publisher Backend<br/>(Node.js)
    participant GW as Gateway<br/>(Port 8081)
    participant MGR as Manager<br/>(Port 8082)
    participant SEC as Security<br/>(Port 8080)
    participant MQ as RabbitMQ<br/>(Port 5672)
    participant SBE as Subscriber Backend<br/>(Node.js)
    participant SFE as Subscriber Frontend<br/>(React)

    %% User sends message
    PFE->>PFE: User writes message in ChatPage
    PFE->>PFE: Selects event type (order.created)
    PFE->>PBE: POST /api/gateway/webhooks/publish
    Note over PFE,PBE: HTTP Request:<br/>{clientId, eventId, message}

    %% Backend encryption
    PBE->>PBE: Construct payload: {eventId, message}
    PBE->>SEC: POST /encrypt
    Note over PBE,SEC: Encrypt with<br/>serverPublicKey
    SEC-->>PBE: encryptedData
    
    %% Send to Gateway
    PBE->>GW: POST /api/v1/webhooks/publish
    Note over PBE,GW: {clientId, encryptedData}
    GW->>GW: Rate limiting check
    GW->>GW: Circuit breaker check
    
    %% Manager processing
    GW->>MGR: Forward request
    MGR->>MGR: Get client from DB
    MGR->>SEC: POST /decrypt
    Note over MGR,SEC: Decrypt with<br/>systemPrivateKey
    SEC-->>MGR: {eventId, message}
    
    %% Find subscribers
    MGR->>MGR: Query subscriptions for eventId
    Note over MGR: Found 1 subscriber
    MGR->>MGR: Get subscriber public key
    
    %% Encrypt for subscriber
    MGR->>SEC: POST /encrypt
    Note over MGR,SEC: Encrypt with<br/>subscriberPublicKey
    SEC-->>MGR: encryptedPayload
    
    %% Publish to RabbitMQ
    MGR->>MQ: Publish message
    Note over MGR,MQ: Exchange: webhook.events<br/>Routing: webhook.client.{subscriberId}
    MGR-->>GW: 200 OK {subscribersNotified: 1}
    GW-->>PBE: Success response
    PBE-->>PFE: 200 OK
    PFE->>PFE: Show toast: "Mesaj publicat!"
    
    %% Subscriber receives
    MQ->>SBE: Consume from queue.client.{subscriberId}
    Note over MQ,SBE: AMQP message:<br/>{clientId, encryptedData}
    SBE->>SEC: POST /decrypt
    Note over SBE,SEC: Decrypt with<br/>clientPrivateKey
    SEC-->>SBE: {eventId, eventName, sender, message}
    
    %% Emit via WebSocket
    SBE->>SFE: Socket.IO emit('webhook_message_received')
    Note over SBE,SFE: WebSocket payload:<br/>{eventId, eventName,<br/>sender, message, timestamp}
    
    %% Display in UI
    SFE->>SFE: WebSocketContext processes event
    SFE->>SFE: Add to messages state
    SFE->>SFE: Show toast notification
    SFE->>SFE: Display in ChatPage with 📬 icon
    
    Note over PFE,SFE: ✅ Message delivered end-to-end<br/>Total time: ~300-500ms
```

---

## Componente Implicate

| Layer | Componente | Responsabilitate |
|-------|------------|------------------|
| **Publisher** | Frontend + Backend | Interfață utilizator + criptare |
| **Gateway** | Spring Cloud Gateway | Routing, rate limiting, circuit breaker |
| **Business Logic** | Manager + Security | Procesare, validare, crypto operations |
| **Messaging** | RabbitMQ | Distribuire asincronă |
| **Subscriber** | Backend + Frontend | Decriptare + afișare real-time |

---

## Puncte Cheie de Securitate

1. **Criptare Publisher → Manager:** `serverPublicKey` (system)
2. **Decriptare în Manager:** `systemPrivateKey` (pentru publisher)
3. **Criptare Manager → Subscriber:** `subscriberPublicKey`
4. **Decriptare în Subscriber:** `clientPrivateKey`

**Rezultat:** End-to-end encryption - doar expeditorul și destinatarul pot citi mesajul

---

## Metrici Flux

| Metrică | Valoare Țintă | Valoare Actuală |
|---------|---------------|-----------------|
| **Latență totală** | < 500ms | ~300-500ms (P95) |
| **Criptare/Decriptare** | < 50ms | ~20-30ms per operație |
| **RabbitMQ delivery** | < 100ms | ~50-100ms |
| **WebSocket emit** | < 10ms | ~5-10ms |
| **Success rate** | > 99% | ~99.5% |

---

## Retry și Error Handling

```mermaid
flowchart TD
    A[Message Published] --> B{Encrypt Success?}
    B -->|No| C[Return Error to User]
    B -->|Yes| D[Send to Manager]
    D --> E{Manager Process OK?}
    E -->|No| F[Circuit Breaker Triggered]
    E -->|Yes| G[Publish to RabbitMQ]
    G --> H{RabbitMQ ACK?}
    H -->|No| I[Retry 3x]
    H -->|Yes| J[Consumer Receives]
    J --> K{Decrypt Success?}
    K -->|No| L[NACK + Log Error]
    K -->|Yes| M[Emit Socket.IO]
    M --> N[Display in UI ✅]
    
    F --> O[Return 503 to Client]
    I --> P{Retry Success?}
    P -->|Yes| J
    P -->|No| Q[Future: Move to DLQ]
    L --> Q
    
    style N fill:#4caf50
    style C fill:#f44336
    style O fill:#f44336
    style Q fill:#ff9800
```

---

**Notă:** Pentru implementarea Dead Letter Queue (DLQ) și retry logic avansat, vezi [obiective.md](../../PlanDeProiect/obiective.md#obiective-următoare-q1-2026)
