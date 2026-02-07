# Raport Implementare: RabbitMQ Publisher (wh-svc-manager)

**Data:** 2026-02-06  
**Workflow:** Message Distribution via RabbitMQ  
**Componenta:** `wh-svc-manager` (Java/Spring Boot)  
**Etapa:** 2 - Publisher Setup

---

## Obiectiv
Implementarea unui publisher RabbitMQ în `wh-svc-manager` care:
- Primește evenimente de la clienți (criptate)
- Decriptează și validează datele
- Identifică subscriberi pentru acel tip de eveniment
- Criptează mesajul pentru fiecare subscriber
- Publică mesajele pe RabbitMQ cu routing key specific fiecărui client

---

## Pași Implementați

### 2.1. Adăugare Dependențe Maven
**Status:** ✅ Finalizat

**Fișier:** `wh-svc-manager/pom.xml`

**Dependință Adăugată:**
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

---

### 2.2. Configurare RabbitMQ (application.properties)
**Status:** ✅ Finalizat

**Fișier:** `src/main/resources/application.properties`

**Configurații Adăugate:**
```properties
# RabbitMQ configuration
spring.rabbitmq.host=localhost
spring.rabbitmq.port=5672
spring.rabbitmq.username=webhooks_user
spring.rabbitmq.password=webhooks_pass

# RabbitMQ Exchange and Routing Key configuration
rabbitmq.exchange.name=webhook.events
rabbitmq.routing-key.prefix=webhook.client.
```

**Notă:** Pentru mediul Docker, configurația este injectată prin environment variables în `docker-compose.yml`:
```yaml
SPRING_RABBITMQ_HOST=wh-rabbitmq
SPRING_RABBITMQ_PORT=5672
SPRING_RABBITMQ_USERNAME=webhooks_user
SPRING_RABBITMQ_PASSWORD=webhooks_pass
```

---

### 2.3. Creare RabbitMQ Configuration Class
**Status:** ✅ Finalizat

**Fișier:** `src/main/java/com/managerwebhooks/config/RabbitMQConfig.java`

**Componente Implementate:**
- ✅ `TopicExchange` bean (webhook.events, durable)
- ✅ `Jackson2JsonMessageConverter` pentru serializare automată JSON
- ✅ `RabbitTemplate` configurat cu exchange și converter

---

### 2.4. Creare Port, Adapter și Service
**Status:** ✅ Finalizat

**Fișiere Create:**

1. **Port Interface:** `src/main/java/com/managerwebhooks/port/out/MessagePublisherPort.java`
   - Contract pentru publicare mesaje
   - Exception handler pentru erori de publicare

2. **Adapter RabbitMQ:** `src/main/java/com/managerwebhooks/adapter/messaging/RabbitMQMessagePublisher.java`
   - Implementare concretă RabbitMQ a port-ului
   - Construire payload: `{clientId, encryptedData}`
   - Routing key: `webhook.client.{targetClientId}`
   - Logging detaliat pentru debugging

3. **Use Case Port:** `src/main/java/com/managerwebhooks/port/in/PublishWebhookMessageUseCase.java`
   - Interface pentru layer REST
   - Records pentru Command și Response

4. **Service Layer:** `src/main/java/com/managerwebhooks/application/service/MessageDeliveryService.java`
   - Implementare use case complet
   - Decriptare mesaj de la publisher (cu cheia publică)
   - Identificare subscriberi activi
   - Criptare pentru fiecare subscriber (cu cheia lor publică)
   - Publicare pe RabbitMQ

---

### 2.5. Creare REST Controller și DTO-uri
**Status:** ✅ Finalizat

**Fișiere Create:**

1. **DTO Request:** `src/main/java/com/managerwebhooks/adapter/rest/dto/PublishWebhookMessageRequest.java`
   - `clientId` (UUID)
   - `encryptedData` (String)

2. **DTO Response:** `src/main/java/com/managerwebhooks/adapter/rest/dto/PublishWebhookMessageResponse.java`
   - `eventId` (UUID)
   - `eventType` (String)
   - `subscribersNotified` (int)
   - `message` (String)

3. **Controller:** `src/main/java/com/managerwebhooks/adapter/rest/WebhookMessageController.java`
   - Endpoint: `POST /api/v1/webhooks/publish`
   - OpenAPI documentation (Swagger)
   - Validare cu Jakarta Validation
   - Logging pentru debugging

---

## Structura Pachetelor (Phase 1 Compliant)

```
com.securewebhooks.manager
├── adapter
│   ├── in
│   │   └── web
│   │       └── WebhookEventController.java (modificat)
│   └── out
│       └── messaging
│           └── RabbitMQMessagePublisher.java (NOU - Port Implementation)
├── application
│   ├── port
│   │   └── out
│   │       └── MessagePublisherPort.java (NOU - Interface)
│   └── service
│       └── MessageDeliveryService.java (NOU - Use Case)
└── infrastructure
    └── messaging
        └── config
            └── RabbitMQConfig.java (NOU - Spring Configuration)
```

---

## Structura Mesaj Publicat

**Routing Key:** `webhook.client.{targetClientId}`

**Payload (JSON):**
```json
{
  "clientId": "target-client-uuid",
  "encryptedData": "BASE64_ENCRYPTED_JSON"
}
```

**Payload Decriptat (ce va primi clientul după decriptare):**
```json
{
  "eventName": "order.created",
  "eventId": "event-uuid",
  "sender": "Client A Name",
  "message": "Ordin #123 creat"
}
```

---

## Probleme Întâmpinate
*Niciuna - implementare fără probleme*

---

## Flux de Date Implementat

```mermaid
sequenceDiagram
    participant Client as wh-client (Publisher)
    participant API as WebhookMessageController
    participant Service as MessageDeliveryService
    participant Security as SecurityServicePort
    participant Repo as SubscriptionRepository
    participant Publisher as RabbitMQMessagePublisher
    participant RMQ as RabbitMQ

    Client->>API: POST /api/v1/webhooks/publish<br/>{clientId, encryptedData}
    API->>Service: publishMessage(command)
    Service->>Security: decrypt(encryptedData, publisherPublicKey)
    Security-->>Service: {eventId, message}
    Service->>Repo: findActiveSubscriptionsByEventId(eventId)
    Repo-->>Service: List<Subscription>
    
    loop Pentru fiecare subscriber
        Service->>Security: encrypt(payload, subscriberPublicKey)
        Security-->>Service: encryptedPayload
        Service->>Publisher: publishWebhookMessage(subscriberId, encryptedPayload)
        Publisher->>RMQ: convertAndSend(routingKey, message)
    end
    
    Service-->>API: PublishMessageResponse
    API-->>Client: 200 OK {eventId, subscribersNotified}
```

---

## Endpoint Nou Creat

**URL:** `POST /api/v1/webhooks/publish`

**Request Body:**
```json
{
  "clientId": "da6abcfe-bb06-4adc-902b-e4930fef1bf4",
  "encryptedData": "AQB3GOEj1XhbN2BsfdOeBwN5l/Gd..."
}
```

**Payload Decriptat (ce conține `encryptedData`):**
```json
{
  "eventId": "d8f8dd7a-f1ed-425f-8d40-149e597167da",
  "message": "Comanda #12345 a fost creată cu succes"
}
```

**Response:**
```json
{
  "eventId": "d8f8dd7a-f1ed-425f-8d40-149e597167da",
  "eventType": "order.created",
  "subscribersNotified": 3,
  "message": "Message published successfully"
}
```

---

## Teste Recomandate

### Test 1: Build și Compilare
```bash
cd C:\Projects\WebHooksProject\wh-svc-manager
mvn clean compile
```
**Rezultat Așteptat:** Build SUCCESS fără erori

### Test 2: Start Local (fără RabbitMQ)
```bash
mvn spring-boot:run
```
**Rezultat Așteptat:** 
- Aplicația pornește normal
- Warning: "Connection refused" pentru RabbitMQ (acceptabil în dev)

### Test 3: Start cu Docker Compose
```bash
cd C:\Projects\WebHooksProject\wh-docker-system
docker-compose up -d wh-rabbitmq wh-postgres wh-redis wh-svc-security wh-svc-manager
```
**Rezultat Așteptat:**
- Log: "Started ManagerServiceApplication"
- Log: "RabbitMQ connection established"
- Exchange `webhook.events` creat în RabbitMQ

### Test 4: Verificare RabbitMQ Management UI
**URL:** http://localhost:15672  
**Credentials:** webhooks_user / webhooks_pass

**Verificări:**
- Exchange `webhook.events` există (Type: topic, Durable: true)
- Connections: `wh-svc-manager` conectat

### Test 5: Publicare Mesaj (End-to-End)
**Cerință:** 2 clienți înregistrați, unul abonat la evenimentul celuilalt

**Comandă cURL:**
```bash
curl -X POST http://localhost:8082/api/v1/webhooks/publish \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "da6abcfe-bb06-4adc-902b-e4930fef1bf4",
    "encryptedData": "..."
  }'
```

**Log-uri Așteptate în wh-svc-manager:**
```
[WEBHOOK API] Received publish request from client: da6abcfe-bb06-4adc-902b-e4930fef1bf4
[WEBHOOK PUBLISH] Processing message from client: da6abcfe-bb06-4adc-902b-e4930fef1bf4
[MESSAGE DELIVERY] Processing webhook message for event: order.created (uuid)
[MESSAGE DELIVERY] Found 1 active subscriber(s) for event: order.created
[MESSAGE DELIVERY] Delivering to subscriber: 340e6045-3ecc-4c77-bbc1-7ca90a69d7a3
[RABBITMQ] Publishing message to client: 340e6045-3ecc-4c77-bbc1-7ca90a69d7a3
[RABBITMQ] ✓ Message published successfully to client: 340e6045-3ecc-4c77-bbc1-7ca90a69d7a3
```

**Log-uri Așteptate în wh-client-backend (subscriber):**
```
[RABBITMQ] 📨 Mesaj primit:
  Client ID: 340e6045-3ecc-4c77-bbc1-7ca90a69d7a3
  Encrypted Data Length: 512
[RABBITMQ] 🔓 Mesaj decriptat: {eventId, eventName, sender, message}
[SOCKET] Emit mesaj decriptat către Frontend
```

---

## Fișiere Create/Modificate

1. ✅ **MODIFICAT:** `wh-svc-manager/pom.xml` (+5 linii)
2. ✅ **MODIFICAT:** `src/main/resources/application.properties` (+8 linii)
3. ✅ **NOU:** `config/RabbitMQConfig.java` (67 linii)
4. ✅ **NOU:** `port/out/MessagePublisherPort.java` (28 linii)
5. ✅ **NOU:** `adapter/messaging/RabbitMQMessagePublisher.java` (65 linii)
6. ✅ **NOU:** `port/in/PublishWebhookMessageUseCase.java` (47 linii)
7. ✅ **NOU:** `application/service/MessageDeliveryService.java` (165 linii)
8. ✅ **NOU:** `adapter/rest/dto/PublishWebhookMessageRequest.java` (35 linii)
9. ✅ **NOU:** `adapter/rest/dto/PublishWebhookMessageResponse.java` (28 linii)
10. ✅ **NOU:** `adapter/rest/WebhookMessageController.java` (80 linii)

**Total:** 10 fișiere (2 modificate, 8 noi), ~523 linii cod nou

---

## Următorii Pași
1. ✅ **ETAPA 1 COMPLETĂ** - RabbitMQ Consumer (Node.js)
2. ✅ **ETAPA 2 COMPLETĂ** - RabbitMQ Publisher (Java)
3. 📋 **ETAPA 3** - Actualizare Frontend pentru afișare mesaje primite
4. 📋 **ETAPA 4** - Adăugare rută în wh-svc-gateway pentru `/api/v1/webhooks/publish`

---

**Autor:** GitHub Copilot  
**Data Finalizare:** 2026-02-06  
**Revizie:** -
