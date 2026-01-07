# RabbitMQ Queue Structure - Hybrid Architecture

## Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PUBLISHER CLIENTS                              │
│                 (Order Service, Payment Service, User Service)          │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY                                    │
│                     (TLS, Authentication)                               │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    EVENT INGESTION SERVICE                              │
│              (Signature Validation, Event Type Check)                   │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ↓
                    ┌────────────────┐
                    │  events.topic  │  ← Topic Exchange
                    │   (exchange)   │
                    └────────┬───────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ↓                    ↓                    ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│events.order  │    │events.payment│    │events.user   │
│  .created    │    │  .completed  │    │ .registered  │
│   (queue)    │    │   (queue)    │    │   (queue)    │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                    │
       └───────────────────┼────────────────────┘
                           │
                           ↓
                ┌──────────────────────┐
                │  EVENT DISPATCHER    │  ← Event Processor
                │  (Fan-out Logic)     │
                └──────────┬───────────┘
                           │
                           ↓ (1 event → N notifications)
                ┌──────────────────────┐
                │ notification.queue   │  ← Single Queue
                │   (all deliveries)   │
                └──────────┬───────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ↓                  ↓                  ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│NOTIFICATION  │  │NOTIFICATION  │  │NOTIFICATION  │
│  WORKER 1    │  │  WORKER 2    │  │  WORKER N    │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │                 │                 │
       ↓                 ↓                 ↓
       │                 │             ┌───────────────┐
       │                 │             │notifications. │
       │                 │             │ dead-letter   │
       │                 │             │    (DLQ)      │
       │                 │             └───────────────┘
       │                 │
       ↓                 ↓
┌─────────────────────────────────────────────────────┐
│          SUBSCRIBER WEBHOOK ENDPOINTS               │
│  (Customer Apps, Mobile Apps, Third-party Systems)  │
└─────────────────────────────────────────────────────┘
```

---

## Queue Details

### 1. Event Ingestion Queues (Per Event Type)

| Queue Name | Purpose | Consumers | Durability |
|------------|---------|-----------|------------|
| `events.order.created` | Order creation events | Event Dispatcher | Durable |
| `events.order.updated` | Order update events | Event Dispatcher | Durable |
| `events.payment.completed` | Payment events | Event Dispatcher | Durable |
| `events.user.registered` | User registration | Event Dispatcher | Durable |
| `events.{eventType}` | Dynamic per registration | Event Dispatcher | Durable |

**Characteristics:**
- Created during event type registration
- One queue per registered event type
- Bound to `events.topic` exchange with routing key `events.{eventType}`
- Consumed by Event Dispatcher workers (can scale per type)

---

### 2. Notification Queue (Single Queue)

| Queue Name | Purpose | Consumers | Durability |
|------------|---------|-----------|------------|
| `notification.queue` | All webhook deliveries | Notification Workers | Durable |

**Message Format:**
```json
{
  "notificationID": "uuid-v4",
  "eventID": "uuid-v4",
  "subscriptionID": 123,
  "subscriberClientID": 456,
  "webhookEndpoint": "https://subscriber.com/webhook",
  "encryptedPayload": "...",
  "hmacSignature": "...",
  "timestamp": "2026-01-07T10:00:00Z",
  "retryCount": 0,
  "metadata": {
    "eventType": "order.created",
    "publisherClientID": 789
  }
}
```

**Characteristics:**
- Single queue for all notification deliveries
- Fan-out: 1 event → N notifications (N = number of subscribers)
- Consumed by pool of Notification Workers
- Workers can scale independently based on queue depth

---

### 3. Dead Letter Queue

| Queue Name | Purpose | Consumers | Durability |
|------------|---------|-----------|------------|
| `notifications.dead-letter` | Failed deliveries | Manual/Admin | Durable |

**Trigger Conditions:**
- Max retries exceeded (3 retries)
- Permanent failures (4xx errors from subscriber)
- Timeout after all retry attempts

**Message Contains:**
- Original notification message
- All retry attempts logged
- Final error message
- Timestamp of final failure

---

## Message Flow Example

### Scenario: `order.created` event with 3 subscribers

```
Step 1: Publisher publishes event
  └─> events.topic exchange
      └─> Routed to: events.order.created queue
          Message count: 1

Step 2: Event Dispatcher processes event
  └─> Consumes from: events.order.created
  └─> Finds 3 subscribers: [A, B, C]
  └─> Encrypts payload 3 times
  └─> Publishes to: notification.queue
      Message count: 3 notifications

Step 3: Notification Workers deliver
  Worker 1 → Notification for Subscriber A → https://subscriber-a.com/webhook
  Worker 2 → Notification for Subscriber B → https://subscriber-b.com/webhook
  Worker 3 → Notification for Subscriber C → https://subscriber-c.com/webhook

Step 4: Retry handling (if needed)
  If Subscriber B fails:
    └─> NACK message
    └─> Requeue with delay (exponential backoff)
    └─> Worker retries after 1s, 2s, 4s
    └─> If all fail → DLQ
```

---

## Scaling Strategy

### Event Dispatcher Scaling

```yaml
# Low traffic event type
events.user.logout:
  workers: 1
  max_messages_per_second: 10

# Medium traffic event type
events.payment.completed:
  workers: 3
  max_messages_per_second: 100

# High traffic event type
events.order.created:
  workers: 5
  max_messages_per_second: 500
```

### Notification Worker Scaling

```yaml
# Based on queue depth
notification.queue:
  min_workers: 5
  max_workers: 50
  scale_up_threshold: 1000 messages
  scale_down_threshold: 100 messages
  worker_concurrency: 10 concurrent requests per worker
```

**Auto-scaling logic:**
```
if queue_depth > 1000:
    scale_workers_to = min(50, queue_depth / 100)
elif queue_depth < 100:
    scale_workers_to = max(5, queue_depth / 20)
```

---

## Performance Estimates

### Throughput Capacity

| Component | Throughput | Latency |
|-----------|------------|---------|
| Event Ingestion | 1,000 events/sec | < 10ms |
| Event Dispatcher | 5,000 notifications/sec | < 50ms |
| Notification Delivery | 500 webhooks/sec/worker | 100-500ms |

### With 10 Notification Workers:
- **Maximum delivery rate:** 5,000 webhooks/second
- **Daily capacity:** 432 million webhook deliveries
- **Handles fan-out:** 1 event → 100 subscribers = 100 notifications/event

---

## Monitoring Dashboards

### Event Ingestion Metrics
```
events.order.created.depth: 23
events.payment.completed.depth: 5
events.user.registered.depth: 0
```

### Notification Queue Metrics
```
notification.queue.depth: 1,234
notification.queue.consumers: 20
notification.queue.message_rate: 234/sec
notification.queue.ack_rate: 220/sec
notification.queue.nack_rate: 14/sec
```

### DLQ Metrics
```
notifications.dead-letter.depth: 5
notifications.dead-letter.total_today: 42
```

---

## Comparison Table

| Architecture | Queues | Scalability | Complexity | Isolation |
|--------------|--------|-------------|------------|-----------|
| **Single Queue** | 1 | ❌ Low | ✅ Simple | ❌ None |
| **Queue per Subscriber** | 1,000+ | ⚠️ Medium | ❌ High | ✅ Perfect |
| **Hybrid (Selected)** | 10-50 | ✅ High | ✅ Medium | ✅ Good |

---

## Implementation Notes

### RabbitMQ Configuration
```bash
# Create topic exchange
rabbitmqadmin declare exchange name=events.topic type=topic durable=true

# Create event type queue (example)
rabbitmqadmin declare queue name=events.order.created durable=true

# Bind queue to exchange
rabbitmqadmin declare binding source=events.topic destination=events.order.created routing_key=events.order.created

# Create notification queue with DLQ
rabbitmqadmin declare queue name=notification.queue durable=true \
  arguments='{"x-dead-letter-exchange":"dlx","x-dead-letter-routing-key":"notifications.dead-letter"}'

# Create DLQ
rabbitmqadmin declare queue name=notifications.dead-letter durable=true
```

### Spring Boot Configuration
```yaml
spring:
  rabbitmq:
    host: rabbitmq
    port: 5672
    username: ${RABBITMQ_USER}
    password: ${RABBITMQ_PASS}
    listener:
      simple:
        concurrency: 5
        max-concurrency: 20
        prefetch: 10
```

---

**Summary:** The hybrid architecture provides the optimal balance between scalability, simplicity, and maintainability for a webhook event delivery system.

