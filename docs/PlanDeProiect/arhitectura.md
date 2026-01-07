---
id: plan-arhitectura
title: Arhitectura servicii
sidebar_position: 1
---

Arhitectură bazată pe microservicii pentru decuplare, scalabilitate și izolare a responsabilităților.

## Componente sistem:

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
6. Security Service
   - Management chei criptografice (asymetric)
   - Rotire chei periodică
   - API pentru semnare/validare HMAC
7. Observability Stack
   - Prometheus + Grafana (metrici)
   - ELK (loguri structurate + corelare)
   - Tracing (OpenTelemetry) – distribuție latențe
8. RabbitMQ Cluster
   - Exchange topic pentru evenimente
   - Cozi dedicate per tip eveniment
   - Politici de retry și DLQ
9. Baza de date (PostgreSQL)
   - Stocare subscripții, secrete, jurnale livrări
   - Indici pentru performanță
10. Redis Cache
   - Caching subscripții active
   - Rate limiting counters

## Flux de inrolare client in sistem:

### Faza 1: Înregistrare inițială

:::info
Această secțiune descrie prima fază a procesului de înrolare a unui client, evidențiind pașii necesari pentru inițierea și securizarea înregistrării prin API Gateway.
:::

1. **Client solicită înrolare:**
   - Client trimite cerere de înregistrare prin API Gateway `/register`

2. **API Gateway procesează cererea:**
   - Gateway solicită un ID client și o cheie publică temporară de la Webhook Management Service

3. **Webhook Management Service generează date temporare:**
   - Solicită o pereche de chei (publică și privată) de la Security Service `/generate-keypair`
   - Primește perechea de chei (systemPubKey, systemPrivKey) de la Security Service
   - Stochează date temporare de înregistrare în Redis (inclusiv systemPrivKey pentru Faza 2)
   - Returnează către Gateway: clientID și systemPubKey

4. **Client primește date inițiale:**
   - API Gateway returnează clientID și systemPubKey către client
   - Client stochează systemPubKey pentru utilizare în Faza 2

### Faza 2: Schimb securizat de chei publice

:::info
Această secțiune detaliază a doua fază a procesului de înrolare, concentrându-se pe schimbul securizat de chei publice între client și sistem, asigurând integritatea și confidențialitatea comunicațiilor viitoare.
:::

1. **Client pregătește propriile chei:**
   - Client generează propria pereche de chei (clientPubKey, clientPrivKey)
   - Client criptează clientPubKey folosind systemPubKey primită în Faza 1
   - Rezultat: encryptedClientPubKey

2. **Client trimite cheia publică criptată:**
   - Client trimite prin API Gateway `/set-client-public-key` cu payload: (clientID, encryptedClientPubKey)
   - Gateway transmite cererea către Webhook Management Service

3. **Webhook Management Service procesează cheia publică a clientului:**
   - Recuperează systemPrivKey temporară din Redis folosind clientID
   - Decriptează encryptedClientPubKey folosind systemPrivKey
   - Obține clientPubKey în clar

4. **Generare pereche finală de chei:**
   - Webhook Management Service solicită Security Service să genereze o nouă pereche de chei pentru client
   - Primește noua pereche (finalSystemPubKey, finalSystemPrivKey)

5. **Stocare în baza de date:**
   - Stochează în PostgreSQL:
     - clientID
     - clientPubKey (decriptată)
     - finalSystemPrivKey (cheia privată finală a sistemului pentru acest client)
     - finalSystemPubKey

6. **Răspuns securizat către client:**
   - Webhook Management Service criptează finalSystemPubKey folosind clientPubKey
   - Returnează către Gateway: Success status + encrypted finalSystemPubKey
   - Gateway transmite către client: Enrollment Complete + encrypted finalSystemPubKey

7. **Client finalizează înrolarea:**
   - Client decriptează encrypted finalSystemPubKey folosind clientPrivKey
   - Stochează finalSystemPubKey pentru utilizare viitoare în operațiuni webhook
   - Înrolarea este completă - ambele părți dețin cheile publice reciproce

### Diagrama de secvență pentru înrolare:

```mermaid
sequenceDiagram
    actor Client
    participant Gateway as API Gateway
    participant Manager as Webhook Management<br/>Service
    participant Security as Security Service
    participant Redis
    participant DB as PostgreSQL

    rect rgb(200, 220, 240)
    Note over Client,DB: Phase 1: Initial Registration
    Client->>Gateway: POST /register
    activate Gateway
    Gateway->>Manager: Request: generate ID & temp key
    activate Manager
    Manager->>Security: POST /generate-keypair
    activate Security
    Security-->>Manager: Return (pubKey, privKey)
    deactivate Security
    Manager->>Redis: Store temporary registration data
    Manager-->>Gateway: Return (clientID, systemPubKey)
    deactivate Manager
    Gateway-->>Client: Return (clientID, systemPubKey)
    deactivate Gateway
    end

    rect rgb(220, 240, 220)
    Note over Client,DB: Phase 2: Public Key Exchange
    Client->>Client: Generate (clientPubKey, clientPrivKey)
    Client->>Client: Encrypt clientPubKey with systemPubKey
    Client->>Gateway: POST /set-client-public-key (clientID, encryptedClientPubKey)
    activate Gateway
    Gateway->>Manager: Forward public key exchange
    Manager->>Redis: Retrieve temporary system private key (systemPrivKey) using clientID
    Redis-->>Manager: Return systemPrivKey
    Manager->>Manager: Decrypt clientPubKey with systemPrivKey
    Manager->>Security: Generate new keypair for client
    Manager->>DB: Store clientPubKey, new system keypair with clientID
    Manager->>Manager: Encrypt systemPubKey with clientPubKey
    Manager-->>Gateway: Success + encrypted systemPubKey
    Gateway-->>Client: Enrollment Complete + encrypted systemPubKey
    deactivate Gateway
    Client->>Client: Decrypt systemPubKey with clientPrivKey and store it for future use
    end

    Note over Client,DB: Enrollment finished - ready for webhook operations
```
## Flux publicarea de evenimente webhook

Dupa finalizarea înrolării, clientul este pregătit să publice și să primească evenimente webhook. Fluxul complet este împărțit în 3 subfluxuri distincte:

1. **Event Registration** - Înregistrarea tipurilor de evenimente
2. **Event Subscription** - Abonarea la tipuri de evenimente
3. **Event Dispatch** - Publicarea și livrarea evenimentelor

---

## Subflux 1: Event Registration (Înregistrarea Evenimentelor)

Înainte de a publica sau a se abona la evenimente, clientul trebuie să înregistreze tipurile de evenimente pe care dorește să le publice. Acest subflux gestionează crearea și validarea noilor tipuri de evenimente în sistem.

### Pași detaliați ai fluxului de înregistrare:

1. **Client solicită înregistrarea tipului de eveniment:**
   - Client trimite cerere prin API Gateway `POST /register-event-type`
   - Payload: (clientID, eventType, eventSchema, eventDescription)
   - Autentificare: Authorization header cu certificate client

2. **API Gateway validează cererea:**
   - Verifică autenticitatea clientului
   - Validează format-ul clientID și eventType
   - Transmite cererea către Webhook Management Service

3. **Webhook Management Service procesează înregistrarea:**
   - Verifică dacă clientID există în baza de date
   - Validează schema JSON a evenimentului
   - Verifică unicitatea eventType pe client (clientID + eventType trebuie unic)
   - Daca tipul de eveniment există deja: Respinge cu HTTP 409 Conflict

4. **Crearea configurației de exchange RabbitMQ:**
   - Webhook Management Service cere Event Ingestion Service să creeze:
     - Exchange topic: `events.topic` (dacă nu există)
     - Queue: `events.{eventType}` dedicată acestui tip
   - Se leagă queue la exchange cu routing key `events.{eventType}`

5. **Stocare în baza de date:**
   - Webhook Management Service stochează în PostgreSQL tabelul `event_types`:
     - eventID (auto-generated)
     - clientID (publisher)
     - eventType
     - eventSchema (JSON)
     - eventDescription
     - createdAt
     - status: ACTIVE

6. **Cache invalidare:**
   - Webhook Management Service invalidează Redis cache pentru lista de tipuri de evenimente
   - Notifică Event Dispatcher despre noul tip de eveniment

7. **Răspuns de confirmare:**
   - Returnează status HTTP 201 Created
   - Payload: (eventID, eventType, message: "Event type registered successfully")

### Diagrama de secvență pentru înregistrare eveniment:

```mermaid
sequenceDiagram
    actor PublisherClient as Publisher Client
    participant Gateway as API Gateway
    participant Manager as Webhook Management<br/>Service
    participant IngestionService as Event Ingestion<br/>Service
    participant RabbitMQ
    participant DB as PostgreSQL
    participant Redis

    Note over PublisherClient,Redis: Event Registration Flow

    PublisherClient->>Gateway: POST /register-event-type<br/>(clientID, eventType, schema)
    activate Gateway
    Gateway->>Gateway: Validate client certificate
    Gateway->>Manager: Forward registration request
    activate Manager

    Manager->>DB: Check if clientID exists
    alt Client not found
        Manager-->>Gateway: 404 Not Found
        Gateway-->>PublisherClient: Error: Client not registered
    else Client exists
        Manager->>DB: Check eventType uniqueness
        alt EventType already exists
            Manager-->>Gateway: 409 Conflict
            Gateway-->>PublisherClient: Error: Event type already registered
        else New event type
            Manager->>IngestionService: Create exchange + queue for eventType
            activate IngestionService
            IngestionService->>RabbitMQ: Declare exchange 'events.topic'
            IngestionService->>RabbitMQ: Declare queue 'events.eventType'
            IngestionService->>RabbitMQ: Bind queue to exchange
            IngestionService-->>Manager: Queue created successfully
            deactivate IngestionService

            Manager->>DB: Insert into event_types table
            Manager->>Redis: Invalidate event types cache
            Manager-->>Gateway: 201 Created
            Gateway-->>PublisherClient: Success + eventID + eventType
            deactivate Manager
            deactivate Gateway
        end
    end
```

### Endpoints necesare pentru Event Registration:

#### API Gateway:
- `POST /register-event-type` - Înregistrare tip de eveniment
  - Request: `{clientID, eventType, eventSchema, eventDescription}`
  - Response: `{eventID, eventType, status}`

#### Event Ingestion Service:
- `POST /create-event-queue` - Creare queue și exchange (intern)

#### Database (PostgreSQL):
- Tabela `event_types`: 
  - eventID (PK)
  - clientID (FK)
  - eventType
  - eventSchema
  - eventDescription
  - createdAt
  - status

#### Cache (Redis):
- Key: `event_types:{clientID}` - Cache tipuri de evenimente per client

---

## Subflux 2: Event Subscription (Abonarea la Evenimente)

După ce un tip de eveniment este înregistrat, alți clienți pot să se aboneze la aceste evenimente. Acest subflux gestionează crearea și validarea abonărilor la evenimentele publicate de alți clienți.

### Pași detaliați ai fluxului de abonare:

1. **Client solicită abonare la eveniment:**
   - Client trimite cerere prin API Gateway `POST /subscribe-to-event`
   - Payload: (subscriberClientID, publisherClientID, eventType, webhookEndpoint, webhookSecret)
   - Autentificare: Authorization header cu certificate client

2. **API Gateway validează cererea:**
   - Verifică autenticitatea clientului
   - Validează format-ul URL-ului webhookEndpoint
   - Transmite cererea către Webhook Management Service

3. **Webhook Management Service validează parametrii:**
   - Verifică dacă subscriberClientID și publisherClientID există în DB
   - Verifică dacă eventType este înregistrat și ACTIVE
   - Validează endpoint-ul (format URL valid, nu local IPs)
   - Daca validare eșuează: Respinge cu HTTP 400 Bad Request

4. **Test conectivitate endpoint-ul:**
   - Webhook Management Service trimite un HTTP POST test la webhookEndpoint
   - Payload: `{event: "test", timestamp: now}`
   - Timeout: 5 secunde
   - Daca endpoint nu răspunde: Respinge cu HTTP 503 Service Unavailable

5. **Stocare în baza de date:**
   - Stochează în PostgreSQL tabelul `subscriptions`:
     - subscriptionID (auto-generated)
     - subscriberClientID
     - publisherClientID
     - eventType
     - webhookEndpoint
     - webhookSecret (criptat)
     - status: ACTIVE
     - createdAt
     - lastDeliveryAt

6. **Invalidare cache și notificare:**
   - Invalidează Redis cache pentru subscripții
   - Notifică Event Dispatcher că există o nouă subscriere
   - Event Dispatcher adaugă noul subscriber în lista sa de urmărire

7. **Răspuns de confirmare:**
   - Returnează status HTTP 201 Created
   - Payload: (subscriptionID, subscriberClientID, publisherClientID, eventType, status)

### Diagrama de secvență pentru abonare la eveniment:

```mermaid
sequenceDiagram
    actor SubscriberClient as Subscriber Client
    participant Gateway as API Gateway
    participant Manager as Webhook Management<br/>Service
    participant RabbitMQ
    participant DB as PostgreSQL
    participant Redis
    participant Webhook as Subscriber Webhook<br/>Endpoint

    Note over SubscriberClient,Webhook: Event Subscription Flow

    SubscriberClient->>Gateway: POST /subscribe-to-event<br/>(subscriberClientID, publisherClientID, eventType, endpoint)
    activate Gateway
    Gateway->>Gateway: Validate client certificate
    Gateway->>Manager: Forward subscription request
    activate Manager

    Manager->>DB: Verify subscriberClientID and publisherClientID exist
    alt Client not found
        Manager-->>Gateway: 404 Not Found
        Gateway-->>SubscriberClient: Error: Client not found
    else Clients exist
        Manager->>DB: Check if eventType is registered and ACTIVE
        alt Event type not found
            Manager-->>Gateway: 404 Not Found
            Gateway-->>SubscriberClient: Error: Event type not registered
        else Event type exists
            Manager->>Manager: Validate webhookEndpoint format
            alt Invalid endpoint
                Manager-->>Gateway: 400 Bad Request
                Gateway-->>SubscriberClient: Error: Invalid endpoint URL
            else Valid endpoint
                Manager->>Webhook: POST test event (timeout: 5s)
                alt Webhook unreachable
                    Webhook-->>Manager: Timeout/Error
                    Manager-->>Gateway: 503 Service Unavailable
                    Gateway-->>SubscriberClient: Error: Webhook endpoint unreachable
                else Webhook reachable
                    Webhook-->>Manager: 200 OK
                    Manager->>DB: Insert into subscriptions table
                    Manager->>Redis: Invalidate subscriptions cache
                    Manager-->>Gateway: 201 Created
                    Gateway-->>SubscriberClient: Success + subscriptionID
                    deactivate Manager
                    deactivate Gateway
                end
            end
        end
    end
```

### Endpoints necesare pentru Event Subscription:

#### API Gateway:
- `POST /subscribe-to-event` - Abonare la tip de eveniment
  - Request: `{subscriberClientID, publisherClientID, eventType, webhookEndpoint, webhookSecret}`
  - Response: `{subscriptionID, status}`

- `GET /list-subscriptions/{clientID}` - Listare abonări ale unui client
  - Response: `[{subscriptionID, publisherClientID, eventType, webhookEndpoint}]`

- `DELETE /unsubscribe/{subscriptionID}` - Anulare abonare
  - Response: `{status: "unsubscribed"}`

#### Database (PostgreSQL):
- Tabela `subscriptions`:
  - subscriptionID (PK)
  - subscriberClientID (FK)
  - publisherClientID (FK)
  - eventType
  - webhookEndpoint
  - webhookSecret (encrypted)
  - status
  - createdAt
  - lastDeliveryAt

#### Cache (Redis):
- Key: `subscriptions:{eventType}` - Cache abonari pe tip de eveniment
- Key: `subscriptions:{subscriberClientID}` - Cache abonari per client

---

## Subflux 3: Event Dispatch (Publicarea și Livrarea Evenimentelor)

Aceasta este faza finală unde evenimentele sunt publicate de clienți și livrate la endpoint-urile webhook ale abonaților. Acest subflux gestionează validarea, publicarea în RabbitMQ și livrarea asincronă.

### Arhitectură Hibridă: Prezentare Generală

Sistemul utilizează o **arhitectură hibridă în 3 faze** pentru a combina scalabilitatea per-tip-eveniment cu simplitatea livrării centralizate:

```
┌─────────────────────────────────────────────────────────────────────┐
│ FAZA 1: EVENT INGESTION (Per Event Type)                           │
│                                                                     │
│  Publisher → API Gateway → Event Ingestion Service                 │
│                                    ↓                                │
│                            events.topic (exchange)                  │
│                                    ↓                                │
│                    ┌───────────────┴───────────────┐               │
│                    ↓               ↓               ↓               │
│            events.order    events.payment   events.user            │
│                .created      .completed     .registered            │
│                                                                     │
│  ✓ Scalabilitate per tip eveniment                                 │
│  ✓ Izolare între tipuri diferite                                   │
│  ✓ No head-of-line blocking                                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ FAZA 2: EVENT PROCESSING & FAN-OUT                                 │
│                                                                     │
│  Event Dispatcher Workers (per event type)                         │
│         ↓                                                           │
│  1. Consumă eveniment din events.{eventType}                       │
│  2. Fetch subscribers din cache/DB                                 │
│  3. Pentru fiecare subscriber:                                     │
│     - Criptează payload                                            │
│     - Calculează HMAC signature                                    │
│     - Creează mesaj notificare                                     │
│  4. Publică N mesaje în notification.queue                         │
│  5. ACK evenimentul original                                       │
│                                                                     │
│  Fan-out: 1 eveniment → N notificări                               │
│                                                                     │
│  ✓ Decuplare: event processing vs delivery                         │
│  ✓ Criptare centralizată                                           │
│  ✓ Single responsibility                                           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ FAZA 3: NOTIFICATION DELIVERY                                      │
│                                                                     │
│            notification.queue (single queue)                       │
│                      ↓                                              │
│      ┌───────────────┼───────────────┐                            │
│      ↓               ↓               ↓                             │
│  Notification   Notification   Notification                        │
│   Worker 1       Worker 2       Worker N                          │
│      ↓               ↓               ↓                             │
│  Subscriber    Subscriber    Subscriber                           │
│  Webhook 1     Webhook 2     Webhook 3                            │
│                                                                     │
│  ✓ Unified retry logic (exponential backoff)                       │
│  ✓ Scalare independentă                                           │
│  ✓ Centralized rate limiting                                       │
│  ✓ DLQ pentru failed deliveries                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Exemplu Concret:**
- Eveniment: `order.created` cu 100 de subscribers
- Rezultat: 1 mesaj în `events.order.created` → Event Dispatcher procesează → 100 mesaje în `notification.queue` → Notification Workers livrează la 100 endpoints

**Beneficii:**
1. **Scalabilitate:** Events cu trafic mare (ex: `user.login`) pot avea workers dedicați fără a afecta events rare (ex: `admin.audit`)
2. **Simplitate:** Un singur pool de Notification Workers pentru toate livrările
3. **Resilience:** Failure la un subscriber nu blochează delivery-ul la alții
4. **Monitorizare:** Metrici separate pentru ingestion, processing și delivery

### Pași detaliați ai fluxului de dispatch:

1. **Client publică eveniment:**
   - Client calculează HMAC-SHA256 al payload-ului folosind clientPrivKey
   - Client trimite evenimentul prin API Gateway `POST /publish-event`
   - Payload: (clientID, eventType, payload, hmacSignature, timestamp)
   - Autentificare: Authorization header cu certificate client

2. **API Gateway rutează cererea:**
   - Verifică autenticitatea clientului
   - Validează format-ul requestului
   - Transmite cererea către Event Ingestion Service

3. **Event Ingestion Service validează semnătura:**
   - Primește cererea de la API Gateway
   - Solicită Security Service pentru validarea semnăturii HMAC `POST /validate-signature`
   - Security Service recuperează clientPubKey din PostgreSQL
   - Validează HMAC-SHA256 folosind clientPubKey
   - Daca validare eșuează: Respinge cu HTTP 401 Unauthorized
   - Daca validare reușește: Continuă

4. **Verificare tip de eveniment:**
   - Event Ingestion Service verifică dacă eventType este înregistrat și ACTIVE
   - Daca nu există: Respinge cu HTTP 404 Not Found
   - Daca inactiv: Respinge cu HTTP 410 Gone

5. **Publicare în RabbitMQ (Event Ingestion Queue):**
   - Event Ingestion Service publicează evenimentul în RabbitMQ
   - Exchange: `events.topic` (topic exchange)
   - Routing key: `events.{eventType}`
   - Target queue: `events.{eventType}` (per event type queue)
   - Message payload: (eventID, clientID, eventType, payload, timestamp, hmacSignature)
   - Durable queue configuration pentru reliability

6. **Răspuns imediat la client:**
   - Returnează HTTP 202 Accepted (asincron processing)
   - Payload: (eventID, status: "accepted", timestamp)

---

#### **Faza 2: Event Processing și Fan-out (Arhitectură Hibridă)**

7. **Event Dispatcher consumă evenimentul din queue dedicată:**
   - Event Dispatcher Workers ascultă `events.{eventType}` queues
   - Fiecare tip de eveniment are propria coadă pentru scalabilitate
   - Preia messajul din queue și deserializează payload-ul
   - Validează structura mesajului

8. **Recuperare lista de subscrieri:**
   - Event Dispatcher solicită Webhook Management Service `GET /get-subscriptions/{eventType}`
   - Încearcă mai întâi cache Redis pentru viteză
   - Daca cache miss: Interogază PostgreSQL
   - Primește lista de subscrieri active cu:
     - subscriptionID
     - subscriberClientID
     - webhookEndpoint
     - webhookSecret

9. **Creare notificări pentru fiecare subscriber (Fan-out):**
   - Pentru fiecare subscriber din listă:
     - Recuperează cheia publică a subscriber-ului din DB
     - Criptează payload-ul folosind Security Service `POST /encrypt-payload`
     - Calculează HMAC-SHA256 al encryptedPayload-ului
     - **Publică mesaj de notificare în `notification.queue`**
     - Mesaj notificare conține:
       - notificationID (UUID)
       - eventID
       - subscriptionID
       - subscriberClientID
       - webhookEndpoint
       - encryptedPayload
       - hmacSignature
       - timestamp
       - retryCount: 0

10. **Confirmă procesarea evenimentului:**
    - Event Dispatcher marchează mesajul ca ACK în `events.{eventType}` queue
    - Logheaza fan-out success în DB (câte notificări create)
    - **Decuplare completă**: event processing vs webhook delivery

---

#### **Faza 3: Notification Delivery (Livrare Webhook)**

11. **Notification Workers consumă din `notification.queue`:**
    - Pool de Notification Workers (scalabile independent)
    - Consumă mesaje de notificare din coada unică
    - Deserializează și pregătește webhook HTTP request

12. **Trimitere webhook la endpoint-ul subscriber-ului:**
    - Notification Worker trimite HTTP POST la webhookEndpoint
    - Headers:
      - `X-Webhook-Event`: eventType
      - `X-Webhook-Publisher`: clientID
      - `X-Webhook-Timestamp`: timestamp
      - `X-Webhook-Signature`: hmacSignature
      - `X-Webhook-ID`: eventID
      - `X-Notification-ID`: notificationID
    - Body: `{encryptedPayload, subscriberID}`
    - Timeout: 10 secunde
    - WebClient non-blocking

13. **Gestionare răspuns succes (2xx):**
    - Endpoint-ul subscriber-ului returnează 200 OK
    - Notification Worker logheaza livrarea reușită
    - Actualizează `lastDeliveryAt` în tabelul subscriptions
    - Marchează mesajul ca ACK în `notification.queue`

14. **Gestionare eșec livrare (4xx, 5xx, timeout):**
    - Notification Worker detectează eșec
    - Verifică retry count (maxim 3 retry-uri)
    - Implementează exponential backoff: 1s, 2s, 4s
    - Re-publicează mesajul în `notification.queue` cu retry_count incrementat
    - **NACK** mesajul pentru requeue cu delay

15. **Dead Letter Queue (DLQ) pentru eșecuri persistente:**
    - Daca retry count depășește 3:
      - Mesajul se trimite în DLQ `notifications.dead-letter`
      - Se logheaza în PostgreSQL `webhook_delivery_logs` cu status FAILED
      - Notifică Notification Service despre livrare eșuată

16. **Logging și monitoring:**
    - Fiecare tentativă de livrare se logheaza în `webhook_delivery_logs`:
      - deliveryID (PK)
      - notificationID (UUID)
      - eventID (FK)
      - subscriptionID (FK)
      - subscriberClientID
      - webhookEndpoint
      - httpStatus
      - responseTime (ms)
      - retryCount
      - status (PENDING, SUCCESS, FAILED)
      - deliveredAt
      - errorMessage (daca eșec)

### Arhitectură Hibridă: Avantaje

Această arhitectură combină:
1. **Queue per event type** (`events.{eventType}`):
   - Scalabilitate: Workers dedicați per tip de eveniment
   - Izolare: Probleme la un tip nu afectează altele
   - Monitorizare: Metrici separate per event type
   - No head-of-line blocking între tipuri diferite

2. **Single notification queue** (`notification.queue`):
   - Simplitate: Un singur pool de Notification Workers
   - Fan-out controlat: Event processing separat de delivery
   - Rate limiting: Control centralizat al ratei de livrare
   - Retry logic unificat: Logică comună pentru toate notificările

### Diagrama de secvență pentru publicare și dispatch eveniment (Arhitectură Hibridă):

```mermaid
sequenceDiagram
    actor PublisherClient as Publisher Client
    participant Gateway as API Gateway
    participant IngestionService as Event Ingestion<br/>Service
    participant SecurityService as Security Service
    participant RabbitMQ
    participant EventDispatcher as Event Dispatcher<br/>(Event Processor)
    participant NotificationWorker as Notification Worker<br/>(Delivery)
    participant Manager as Webhook Management<br/>Service
    participant Redis
    participant DB as PostgreSQL
    actor SubscriberClient as Subscriber Client

    Note over PublisherClient,SubscriberClient: Phase 1: Event Ingestion

    PublisherClient->>PublisherClient: Calculate HMAC-SHA256 with private key
    PublisherClient->>Gateway: POST /publish-event (clientID, eventType, payload, signature)
    
    activate Gateway
    Gateway->>Gateway: Validate client certificate
    Gateway->>IngestionService: Forward publish request
    activate IngestionService
    
    IngestionService->>SecurityService: POST /validate-signature
    activate SecurityService
    SecurityService->>DB: Fetch clientPubKey
    SecurityService-->>SecurityService: Validate HMAC
    SecurityService-->>IngestionService: Validation result
    deactivate SecurityService
    
    alt Signature Invalid
        IngestionService-->>Gateway: 401 Unauthorized
        Gateway-->>PublisherClient: Error: Invalid signature
    else Event Type Invalid
        IngestionService->>DB: Check eventType status
        alt Event type not found
            IngestionService-->>Gateway: 404 Not Found
            Gateway-->>PublisherClient: Error: Event type not registered
        else Event type inactive
            IngestionService-->>Gateway: 410 Gone
            Gateway-->>PublisherClient: Error: Event type inactive
        else Signature Valid
            IngestionService->>RabbitMQ: Publish to events.{eventType} queue
            Note right of RabbitMQ: Per-event-type queue<br/>for scalability
            IngestionService-->>Gateway: 202 Accepted
            Gateway-->>PublisherClient: Success + eventID
            deactivate Gateway
            deactivate IngestionService

            Note over EventDispatcher,NotificationWorker: Phase 2: Event Processing & Fan-out

            EventDispatcher->>RabbitMQ: Consume from events.{eventType}
            activate EventDispatcher
            RabbitMQ-->>EventDispatcher: Deliver event message

            EventDispatcher->>Redis: Get subscriptions for eventType
            alt Cache hit
                Redis-->>EventDispatcher: Return subscriber list
            else Cache miss
                EventDispatcher->>Manager: GET /get-subscriptions/{eventType}
                activate Manager
                Manager->>DB: Query subscriptions
                DB-->>Manager: Return subscribers
                Manager->>Redis: Cache result
                Manager-->>EventDispatcher: Subscriber list
                deactivate Manager
            end

            loop For each subscriber
                EventDispatcher->>DB: Fetch subscriber public key
                EventDispatcher->>SecurityService: POST /encrypt-payload
                activate SecurityService
                SecurityService-->>EventDispatcher: Encrypted payload
                deactivate SecurityService

                EventDispatcher->>SecurityService: POST /calculate-signature
                activate SecurityService
                SecurityService-->>EventDispatcher: HMAC signature
                deactivate SecurityService

                EventDispatcher->>RabbitMQ: Publish to notification.queue
                Note right of RabbitMQ: Fan-out: 1 event → N notifications<br/>Single queue for all deliveries
            end

            EventDispatcher->>RabbitMQ: ACK event message
            EventDispatcher->>DB: Log fan-out success
            deactivate EventDispatcher

            Note over NotificationWorker,SubscriberClient: Phase 3: Notification Delivery

            NotificationWorker->>RabbitMQ: Consume from notification.queue
            activate NotificationWorker
            RabbitMQ-->>NotificationWorker: Deliver notification

            NotificationWorker->>SubscriberClient: POST webhookEndpoint<br/>(encryptedPayload + headers)
            
            alt Delivery Success (2xx)
                SubscriberClient-->>NotificationWorker: 200 OK
                NotificationWorker->>DB: Log SUCCESS delivery
                NotificationWorker->>DB: Update lastDeliveryAt
                NotificationWorker->>RabbitMQ: ACK notification
            else Delivery Failure
                SubscriberClient-->>NotificationWorker: Error/Timeout
                NotificationWorker->>NotificationWorker: Check retry count
                alt Retries available (< 3)
                    NotificationWorker->>RabbitMQ: NACK + Requeue with delay
                    Note right of RabbitMQ: Exponential backoff:<br/>1s, 2s, 4s
                    NotificationWorker->>DB: Log PENDING delivery
                else Max retries exceeded (>= 3)
                    NotificationWorker->>RabbitMQ: Send to notifications.dead-letter
                    NotificationWorker->>DB: Log FAILED delivery
                    NotificationWorker->>Manager: Notify delivery failure
                end
            end
            deactivate NotificationWorker
        end
    end
```

### Endpoints necesare pentru Event Dispatch:

#### API Gateway:
- `POST /publish-event` - Publicare eveniment
  - Request: `{clientID, eventType, payload, hmacSignature}`
  - Response: `{eventID, status: "accepted"}`

#### Event Ingestion Service:
- `POST /publish-event` - Primire și validare eveniment (intern din Gateway)
- Consumă din RabbitMQ topic exchange

#### Security Service:
- `POST /validate-signature` - Validare semnătură HMAC
- `POST /encrypt-payload` - Criptare payload cu cheia publică
- `POST /calculate-signature` - Calcul semnătură HMAC

#### Webhook Management Service:
- `GET /get-subscriptions/{eventType}` - Recuperare lista de subscriber-i
  - Response: `[{subscriptionID, subscriberClientID, webhookEndpoint, webhookSecret}]`

#### Event Dispatcher (Event Processor):
- Consumă din RabbitMQ queues per event type (`events.{eventType}`)
- Recuperează lista de subscrieri pentru fiecare eveniment
- Criptează payload pentru fiecare subscriber
- Publică notificări în `notification.queue` (fan-out)

#### Notification Workers (Delivery):
- Consumă din RabbitMQ `notification.queue`
- HTTP POST la endpoint-uri externe (subscriber webhooks)
- Implementează retry logic cu exponential backoff (1s, 2s, 4s)
- Trimite mesaje eșuate în `notifications.dead-letter` DLQ
- Scalare independentă de Event Dispatcher

#### Database (PostgreSQL):
- Tabela `webhook_delivery_logs`:
  - deliveryID (PK)
  - notificationID (UUID) - unique identifier per notification
  - eventID (FK)
  - subscriptionID (FK)
  - subscriberClientID
  - webhookEndpoint
  - httpStatus
  - responseTime
  - retryCount
  - status (PENDING, SUCCESS, FAILED)
  - deliveredAt
  - errorMessage

#### Cache (Redis):
- Key: `subscriptions:{eventType}` - Cache subscripții per tip eveniment
- Key: `event_types:{clientID}` - Cache tipuri de evenimente publicate

#### RabbitMQ Queue Structure (Hybrid Architecture):

**Event Ingestion Layer:**
- **Exchange**: `events.topic` (topic exchange)
- **Queues**: `events.{eventType}` (one per registered event type)
  - Routing key: `events.{eventType}`
  - Consumers: Event Dispatcher (Event Processor)
  - Purpose: Per-type scalability and isolation
  - Durability: Durable queues with persistence

**Notification Delivery Layer:**
- **Queue**: `notification.queue` (single queue for all notifications)
  - Consumers: Notification Workers (scalable pool)
  - Purpose: Centralized webhook delivery with unified retry logic
  - Message format: `{notificationID, eventID, subscriptionID, subscriberClientID, webhookEndpoint, encryptedPayload, hmacSignature, timestamp, retryCount}`

**Dead Letter Queues:**
- `notifications.dead-letter` - Failed notifications after max retries
- Purpose: Manual inspection and retry of failed deliveries

**Example Flow:**
```
Publisher → events.topic → events.order.created → Event Dispatcher
                                                        ↓
                                            (3 subscribers found)
                                                        ↓
                        notification.queue ← 3 notification messages
                                ↓
                        Notification Workers → Webhook endpoints
```

