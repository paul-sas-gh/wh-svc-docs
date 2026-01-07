# Hybrid Architecture Decision: Event Dispatch System

**Date:** January 7, 2026  
**Status:** ✅ Approved and Implemented  
**Decision:** Implement hybrid queue architecture for webhook event delivery

---

## Context

We needed to design the RabbitMQ queue structure for our webhook event dispatch system. The key question was:

> **Should we create a separate queue for each event type, or use a single queue for all events?**

## Analysis of Approaches

### ❌ Option 1: Separate Queue per Subscriber
```
events.{eventType}.{subscriberID}
```
**Problems:**
- Queue explosion (1000 subscribers × 10 event types = 10,000 queues)
- Complex management
- RabbitMQ resource overhead

### ❌ Option 2: Single Queue for Everything
```
events.queue → Dispatcher → notification.queue
```
**Problems:**
- Scalability bottleneck
- Head-of-line blocking (slow event type blocks fast ones)
- Cannot scale per event type
- Single point of failure

### ✅ Option 3: Hybrid Architecture (SELECTED)
```
events.{eventType} → Event Dispatcher → notification.queue → Notification Workers
```

---

## Hybrid Architecture Design

### Phase 1: Event Ingestion (Per Event Type)

**Queue Structure:**
- Exchange: `events.topic` (topic exchange)
- Queues: `events.{eventType}` (one per registered event type)
- Routing key: `events.{eventType}`

**Responsibilities:**
1. Publisher sends event to API Gateway
2. Event Ingestion Service validates signature and event type
3. Publishes to `events.{eventType}` queue
4. Returns HTTP 202 Accepted immediately

**Benefits:**
- ✅ Scalable: Independent workers per event type
- ✅ Isolation: Problems with one event type don't affect others
- ✅ Monitoring: Separate metrics per event type
- ✅ Priority: Can prioritize high-value event types
- ✅ No head-of-line blocking

### Phase 2: Event Processing & Fan-out

**Component:** Event Dispatcher (Event Processor)

**Responsibilities:**
1. Consumes from `events.{eventType}` queues
2. Fetches subscribers from cache/database
3. For each subscriber:
   - Encrypts payload with subscriber's public key
   - Calculates HMAC signature
   - Creates notification message
4. Publishes N notification messages to `notification.queue`
5. ACKs the original event

**Benefits:**
- ✅ Decoupling: Event processing separate from delivery
- ✅ Centralized encryption and signature logic
- ✅ Single responsibility principle
- ✅ Fan-out happens in controlled manner

### Phase 3: Notification Delivery

**Queue:** `notification.queue` (single queue)

**Component:** Notification Workers (scalable pool)

**Responsibilities:**
1. Consumes notification messages
2. HTTP POST to subscriber webhook endpoint
3. Retry logic with exponential backoff (1s, 2s, 4s)
4. Sends failed messages to DLQ after max retries

**Benefits:**
- ✅ Unified retry logic for all notifications
- ✅ Centralized rate limiting
- ✅ Simple to scale (add more workers)
- ✅ Independent from event processing

---

## Message Flow Example

### Scenario: Order Created Event with 100 Subscribers

```
1. Publisher publishes order.created event
   ↓
2. Event Ingestion Service → events.order.created queue (1 message)
   ↓
3. Event Dispatcher consumes event
   - Finds 100 subscribers
   - Encrypts payload 100 times
   - Publishes 100 notification messages
   ↓
4. notification.queue (100 messages)
   ↓
5. Notification Workers (pool of N workers)
   - Worker 1 delivers to Subscriber A
   - Worker 2 delivers to Subscriber B
   - ...
   - Worker N delivers to Subscriber Z
   ↓
6. Each worker handles retries independently
```

**Result:** 
- Fan-out amplification: 1 → 100
- But processed efficiently with controlled phases

---

## Queue Configuration

### Event Queues
```yaml
events.{eventType}:
  durable: true
  auto-delete: false
  arguments:
    x-queue-type: classic
    x-max-priority: 10
```

### Notification Queue
```yaml
notification.queue:
  durable: true
  auto-delete: false
  arguments:
    x-queue-type: classic
    x-dead-letter-exchange: dlx
    x-dead-letter-routing-key: notifications.dead-letter
```

### Dead Letter Queue
```yaml
notifications.dead-letter:
  durable: true
  auto-delete: false
```

---

## Scalability Considerations

### Event Dispatcher Scaling
- **Horizontal:** Add more workers per event type
- **Vertical:** Allocate more resources to high-volume event types
- **Dynamic:** Scale based on queue depth metrics

### Notification Worker Scaling
- **Horizontal:** Add more workers to pool
- **Auto-scaling:** Based on `notification.queue` depth
- **Rate limiting:** Control delivery rate per subscriber

### Example Scaling Strategy
```
Low traffic event:  events.user.logout      → 1 Event Dispatcher worker
High traffic event: events.order.created    → 5 Event Dispatcher workers
Notification pool:  notification.queue      → 20 Notification Workers
```

---

## Monitoring & Metrics

### Per Event Type
- `events.{eventType}.queue.depth` - Queue depth
- `events.{eventType}.processing.time` - Time to process event
- `events.{eventType}.fanout.count` - Number of notifications created

### Notification Delivery
- `notification.queue.depth` - Overall notification backlog
- `notification.delivery.success.rate` - Successful deliveries
- `notification.delivery.latency` - Time from publish to delivery
- `notification.retry.count` - Number of retries
- `notification.dlq.count` - Failed deliveries in DLQ

---

## Database Schema Updates

### webhook_delivery_logs
```sql
CREATE TABLE webhook_delivery_logs (
    delivery_id BIGSERIAL PRIMARY KEY,
    notification_id UUID NOT NULL UNIQUE,  -- NEW: Track individual notifications
    event_id UUID NOT NULL,
    subscription_id BIGINT NOT NULL,
    subscriber_client_id BIGINT NOT NULL,
    webhook_endpoint VARCHAR(500) NOT NULL,
    http_status INT,
    response_time_ms INT,
    retry_count INT DEFAULT 0,
    status VARCHAR(20) NOT NULL,  -- PENDING, SUCCESS, FAILED
    delivered_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notification_id ON webhook_delivery_logs(notification_id);
CREATE INDEX idx_event_id ON webhook_delivery_logs(event_id);
CREATE INDEX idx_status ON webhook_delivery_logs(status);
```

---

## Implementation Checklist

- [x] Update architecture documentation
- [x] Design hybrid queue structure
- [x] Define message formats for each phase
- [ ] Implement Event Dispatcher service
  - [ ] Consume from `events.{eventType}` queues
  - [ ] Fetch subscribers with caching
  - [ ] Encrypt payloads per subscriber
  - [ ] Publish to `notification.queue`
- [ ] Implement Notification Worker service
  - [ ] Consume from `notification.queue`
  - [ ] HTTP POST to webhook endpoints
  - [ ] Retry logic with exponential backoff
  - [ ] DLQ handling
- [ ] Update database schema
  - [ ] Add `notification_id` to `webhook_delivery_logs`
- [ ] Configure RabbitMQ queues
  - [ ] Create topic exchange
  - [ ] Configure DLQ
- [ ] Implement monitoring
  - [ ] Queue depth metrics
  - [ ] Delivery success rates
  - [ ] Latency tracking

---

## Future Enhancements

1. **Priority Queues:** Different priority levels for critical events
2. **Rate Limiting:** Per-subscriber rate limits in Notification Workers
3. **Circuit Breaker:** Temporarily disable slow/failing subscribers
4. **Batch Delivery:** Group multiple events to same subscriber
5. **Compression:** Compress large payloads before delivery

---

## References

- Architecture Documentation: `wh-svc-docs/docs/PlanDeProiect/arhitectura.md`
- RabbitMQ Topic Exchange: https://www.rabbitmq.com/tutorials/tutorial-five-python.html
- Fan-out Pattern: https://www.enterpriseintegrationpatterns.com/patterns/messaging/Broadcast.html

---

## Decision Rationale

**Why not single queue?**
- Cannot scale per event type
- Head-of-line blocking
- No isolation between event types

**Why not queue per subscriber?**
- Queue explosion (too many queues)
- Complex management
- Resource overhead

**Why hybrid approach?**
- ✅ Best of both worlds
- ✅ Scalable event ingestion
- ✅ Simple notification delivery
- ✅ Clear separation of concerns
- ✅ Maintainable and extensible

---

**Approved by:** Development Team  
**Next Steps:** Implement Event Dispatcher and Notification Worker services

