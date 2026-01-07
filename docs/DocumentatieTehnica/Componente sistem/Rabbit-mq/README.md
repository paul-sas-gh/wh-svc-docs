---
id: rabbitmq
slug: /DocumentatieTehnica/Componente sistem/rabbitmq
title: RabbitMQ - Message Broker
---

# RabbitMQ Message Broker

RabbitMQ este message broker-ul central al sistemului Secure WebHooks, responsabil pentru transmiterea asincronă și fiabilă a evenimentelor între servicii.

## Overview

RabbitMQ implementează protocolul AMQP (Advanced Message Queuing Protocol) și oferă:
- ✅ Pub/Sub cu topic exchanges
- ✅ Message persistence și durability
- ✅ Retry logic și dead letter queues
- ✅ Management UI pentru monitoring
- ✅ Scalabilitate pentru volume mari de mesaje

## Rol în Arhitectura Hibridă

RabbitMQ suportă arhitectura hibridă a sistemului de publicare Evenimente:

```
┌─ PHASE 1: Event Ingestion ─────────────────────┐
│                                                │
│  events.topic (Topic Exchange)                │
│         │                                      │
│         ├─ events.order.created (queue)       │
│         ├─ events.payment.completed (queue)   │
│         └─ events.{eventType} (queue) × N     │
│                                                │
│  Avantaje:                                     │
│  • Scalabilitate per tip eveniment            │
│  • Izolare între tipuri diferite               │
│  • No head-of-line blocking                   │
│                                                │
└────────────────────────────────────────────────┘
              ↓
┌─ PHASE 2: Event Processing ─────────────────┐
│                                              │
│  Event Dispatcher                           │
│  (Fan-out logic)                            │
│                                              │
└──────────────────────────────────────────────┘
              ↓
┌─ PHASE 3: Notification Delivery ────────────┐
│                                              │
│  notification.queue (Single queue)          │
│         │                                    │
│         └─ Notification Workers (N)         │
│                                              │
│  Avantaje:                                   │
│  • Unificat retry logic                      │
│  • Scalare independentă                      │
│  • Rate limiting centralizat                 │
│                                              │
└──────────────────────────────────────────────┘
```

## Topologie Cozi și Exchange-uri

### Topic Exchange

**Nume**: `events.topic`  
**Tip**: Topic Exchange  
**Durability**: Durable  
**Auto-delete**: No

Rutează evenimentele la cozi dedicate pe baza routing key-ului.

### Event Ingestion Queues (Per Type)

Cozi pentru fiecare tip de eveniment înregistrat:

| Queue Name | Routing Key | Purpose |
|-----------|-------------|---------|
| `events.order.created` | `events.order.created` | Events de tip "order.created" |
| `events.payment.completed` | `events.payment.completed` | Events de tip "payment.completed" |
| `events.user.registered` | `events.user.registered` | Events de tip "user.registered" |
| `events.{eventType}` | `events.{eventType}` | Cozi dinamice per event type |

**Configurare Queue**:
- Type: Classic Queue
- Durable: Yes
- Priority: Max 10
- Arguments: `x-queue-type: classic`, `x-max-priority: 10`

### Notification Queue

**Nume**: `notification.queue`  
**Tip**: Classic Queue  
**Durability**: Durable  
**Dead Letter Exchange**: dlx  
**Dead Letter Routing Key**: notifications.dead-letter

Coadă unică pentru toți subscriptori care trebuie să primească notificări webhook.

### Dead Letter Queue

**Nume**: `notifications.dead-letter`  
**Tip**: Classic Queue  
**Durability**: Durable

Stochează mesajele care au depășit numărul maxim de retry-uri.

## Deployment

### Docker Deployment

RabbitMQ este deployed ca container Docker în `wh-docker-system`:

```bash
cd wh-docker-system
docker-compose up -d rabbitmq
```

### Configurare

**Container Details**:
- Image: `rabbitmq:3.13-management-alpine`
- Container: `wh-rabbitmq`
- AMQP Port: 5672
- Management UI: 15672
- Network: `webhooks-network`

**Credențiale Implicite**:
- Username: `webhooks_user`
- Password: `webhooks_pass`
- Virtual Host: `/`

### Management UI

Accesează: **http://localhost:15672**

Interfață grafică pentru:
- Creare și management exchange-uri
- Creare și management cozi
- Creare și management binding-uri
- Monitorizare mesaje și consumers
- Analiză performanță

## Configurare Aplicații Spring

### Dependență Maven

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

### application.yml Configuration

```yaml
spring:
  rabbitmq:
    # Connection
    host: rabbitmq                    # Hostname (Docker network)
    port: 5672                        # AMQP port
    username: webhooks_user
    password: webhooks_pass
    virtual-host: /
    
    # Connection pooling
    dynamic: true
    
    # Listener configuration
    listener:
      simple:
        concurrency: 5                # Min number of consumers
        max-concurrency: 20           # Max number of consumers
        prefetch: 10                  # Prefetch count per consumer
        acknowledge-mode: AUTO        # Auto-acknowledge messages
        default-requeue-rejected: true # Requeue failed messages
    
    # Template configuration
    template:
      retry:
        enabled: true
        initial-interval: 1000        # 1 second
        max-interval: 10000           # 10 seconds
        multiplier: 2.0               # Exponential backoff
        max-attempts: 3
```

## Message Publishing

### RabbitTemplate Configuration

```java
@Configuration
public class RabbitConfig {
    
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(new Jackson2JsonMessageConverter());
        template.setDefaultReceiveQueue("notification.queue");
        return template;
    }
    
    @Bean
    public Jackson2JsonMessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
```

### Publishing Events

```java
@Service
public class EventPublisher {
    
    @Autowired
    private RabbitTemplate rabbitTemplate;
    
    public void publishEvent(String eventType, EventMessage message) {
        // Publish to topic exchange with event type as routing key
        rabbitTemplate.convertAndSend(
            "events.topic",              // Exchange
            "events." + eventType,       // Routing key
            message                      // Message payload
        );
    }
}
```

## Message Consumption

### RabbitListener Configuration

```java
@Component
public class EventDispatcher {
    
    // Listen to event ingestion queues (per event type)
    @RabbitListener(queues = "events.order.created")
    public void handleOrderCreated(@Payload EventMessage message) {
        // Process order.created event
        // Fetch subscribers
        // Encrypt payloads
        // Publish to notification.queue
    }
    
    @RabbitListener(queues = "events.payment.completed")
    public void handlePaymentCompleted(@Payload EventMessage message) {
        // Process payment.completed event
    }
}

@Component
public class NotificationWorker {
    
    // Listen to notification queue
    @RabbitListener(queues = "notification.queue")
    public void handleNotification(@Payload NotificationMessage message) {
        // Deliver webhook notification
        // Handle retries
        // Send to DLQ on failure
    }
}
```

### Error Handling

```java
@Component
public class NotificationWorker {
    
    @RabbitListener(queues = "notification.queue")
    public void handleNotification(@Payload NotificationMessage message) {
        try {
            deliverWebhook(message);
        } catch (Exception e) {
            // Log error
            log.error("Failed to deliver webhook: {}", message.getNotificationID(), e);
            
            // Check retry count
            if (message.getRetryCount() < 3) {
                // Increment retry count
                message.setRetryCount(message.getRetryCount() + 1);
                
                // Requeue with exponential backoff
                // Framework handles re-publishing
                throw new AmqpRejectAndDontRequeueException(e);
            } else {
                // Max retries exceeded - will go to DLQ
                throw e;
            }
        }
    }
}
```

## Message Formats

### Event Message (Event Ingestion)

```json
{
  "eventID": "4e91c6d0-7b36-4c25-9f9a-3de5b0b85c01",
  "clientID": "d4c5b3c0-6a3e-4c2e-8d9f-1b2a3c4d5e6f",
  "eventType": "order.created",
  "payload": {
    "orderId": "12345",
    "amount": 99.99,
    "status": "created",
    "timestamp": "2026-01-07T10:00:00Z"
  },
  "timestamp": "2026-01-07T10:00:00Z",
  "hmacSignature": "base64-encoded-signature"
}
```

### Notification Message (Notification Queue)

```json
{
  "notificationID": "5f92d7e1-8c47-4d36-9e0b-2c3d4e5f6a7b",
  "eventID": "4e91c6d0-7b36-4c25-9f9a-3de5b0b85c01",
  "subscriptionID": 123,
  "subscriberClientID": "a1b2c3d4-e5f6-4c25-9f9a-1b2a3c4d5e6f",
  "webhookEndpoint": "https://subscriber.example.com/webhooks",
  "encryptedPayload": "base64-encoded-ciphertext",
  "hmacSignature": "base64-encoded-signature",
  "timestamp": "2026-01-07T10:00:00Z",
  "retryCount": 0,
  "metadata": {
    "eventType": "order.created",
    "publisherClientID": "d4c5b3c0-6a3e-4c2e-8d9f-1b2a3c4d5e6f"
  }
}
```

## Monitoring și Diagnostică

### Comenzi Utile

```bash
# Check RabbitMQ health
docker exec wh-rabbitmq rabbitmq-diagnostics ping

# List all queues
docker exec wh-rabbitmq rabbitmq-diagnostics queues

# List all exchanges
docker exec wh-rabbitmq rabbitmq-diagnostics exchanges

# List all bindings
docker exec wh-rabbitmq rabbitmq-diagnostics bindings

# List connections
docker exec wh-rabbitmq rabbitmq-diagnostics connections

# Check memory usage
docker exec wh-rabbitmq rabbitmq-diagnostics memory_breakdown

# View logs
docker logs -f wh-rabbitmq
```

### Metrici Importante

Via Management UI sau CLI:

- **Queue Depth**: Numărul de mesaje în așteptare în coadă
- **Message Rate**: Mesaje publicate/consumate pe secundă
- **Consumer Count**: Numărul de consumatori activi per coadă
- **Unacked Messages**: Mesaje în curs de procesare
- **Memory Usage**: Memorie folosită de RabbitMQ

## Performance Tuning

### Consumer Prefetch

```yaml
spring:
  rabbitmq:
    listener:
      simple:
        prefetch: 10  # Tune based on message processing time
```

- Valori mici (1-5): Distribuire mai bună, latență mai mică
- Valori mari (20-50): Throughput mai mare, latență mai mare

### Concurrency Adjustment

```yaml
spring:
  rabbitmq:
    listener:
      simple:
        concurrency: 5          # Minimum threads
        max-concurrency: 20     # Maximum threads
```

### Lazy Queue (High Volume)

```bash
docker exec wh-rabbitmq rabbitmqctl set_policy lazy-queue \
  ".*" '{"queue-mode":"lazy"}' \
  --apply-to queues
```

Pentru volume foarte mari de mesaje, queue mode "lazy" stochează mesajele pe disk mai agresiv.

## Troubleshooting

### Queue is Not Receiving Messages

1. Verifică că exchange-ul și queue-ul sunt create
2. Verifică că binding-ul existe cu routing key corect
3. Verifică că publisher-ul publică la routing key corect
4. Verifică conexiunea RabbitMQ din aplicație

```bash
# Verify binding exists
docker exec wh-rabbitmq rabbitmq-diagnostics bindings
```

### High Memory Usage

1. Verifică queue depth
2. Verifică dacă sunt consumatori activi
3. Purge queue-ul dacă nu mai sunt necesare mesajele:

```bash
docker exec wh-rabbitmq rabbitmqctl purge_queue notification.queue
```

### Consumer Lag

1. Mărește concurrency și max-concurrency
2. Micsora prefetch dacă sunt timeout-uri
3. Optimizează logica de procesare a mesajelor

## Resurse și Referințe

- [RabbitMQ Official Documentation](https://www.rabbitmq.com/documentation.html)
- [AMQP 0-9-1 Quick Reference](https://www.rabbitmq.com/amqp-0-9-1-quickref.html)
- [Spring AMQP Documentation](https://docs.spring.io/spring-amqp/reference/)
- [RabbitMQ Topic Exchange Tutorial](https://www.rabbitmq.com/tutorials/tutorial-five-python.html)
- [Local Setup Guide](./RABBITMQ-SETUP.md)

