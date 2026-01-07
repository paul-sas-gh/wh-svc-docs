# RabbitMQ Setup Guide

## Overview

RabbitMQ is a message broker that implements the AMQP (Advanced Message Queuing Protocol). It's used in the Webhook system for:
- Event ingestion queue: per-event-type queues (`events.{eventType}`)
- Notification delivery queue: single queue for webhook deliveries (`notification.queue`)
- Dead letter queue: failed delivery handling (`notifications.dead-letter`)

## Quick Start

### 1. Start RabbitMQ Container

```bash
cd wh-docker-system
docker-compose up -d rabbitmq
```

### 2. Verify RabbitMQ is Running

```bash
# Check container status
docker ps | grep rabbitmq

# Check health
docker exec wh-rabbitmq rabbitmq-diagnostics ping

# Expected output: 
# Success: passed list of checks: [channels_and_queues, ...] 
```

### 3. Access Management UI

Open browser: **http://localhost:15672**

Login credentials:
- **Username**: webhooks_user
- **Password**: webhooks_pass

## Connection Details

| Property | Value |
|----------|-------|
| **Host** | localhost (from host machine) or `rabbitmq` (from Docker network) |
| **AMQP Port** | 5672 |
| **Management UI Port** | 15672 |
| **Username** | webhooks_user |
| **Password** | webhooks_pass |
| **Virtual Host** | / (default) |

## RabbitMQ Topology

### Topic Exchange

**Name**: `events.topic`  
**Type**: Topic Exchange  
**Durability**: Durable  
**Purpose**: Routes event messages to per-type queues

### Event Ingestion Queues

**Pattern**: `events.{eventType}`  
**Examples**:
- `events.order.created`
- `events.payment.completed`
- `events.user.registered`

**Configuration**:
- Type: Classic Queue
- Durable: Yes
- Priority: Max 10

### Notification Queue

**Name**: `notification.queue`  
**Type**: Classic Queue  
**Durability**: Durable  
**Dead Letter Exchange**: dlx  
**Dead Letter Routing Key**: notifications.dead-letter  
**Purpose**: Fan-out notifications to multiple subscribers

### Dead Letter Queue

**Name**: `notifications.dead-letter`  
**Type**: Classic Queue  
**Durability**: Durable  
**Purpose**: Store failed notifications after max retries

## Application Configuration

### Spring Boot YAML Configuration

```yaml
spring:
  rabbitmq:
    host: rabbitmq                    # or localhost from host machine
    port: 5672
    username: webhooks_user
    password: webhooks_pass
    virtual-host: /
    listener:
      simple:
        concurrency: 5                # Min consumer threads
        max-concurrency: 20           # Max consumer threads
        prefetch: 10                  # Prefetch count per consumer
        acknowledge-mode: AUTO        # Auto-acknowledge messages
        default-requeue-rejected: true # Requeue on exception
```

### RabbitTemplate Configuration (Publishing)

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
}
```

### RabbitListener Configuration (Consuming)

```java
@Component
public class EventDispatcher {
    
    @RabbitListener(queues = "events.order.created")
    public void handleOrderCreated(@Payload EventMessage message) {
        // Process order.created event
        // Publish notifications to notification.queue
    }
    
    @RabbitListener(queues = "notification.queue")
    public void handleNotification(@Payload NotificationMessage message) {
        // Deliver webhook notification
        // Retry on failure
    }
}
```

## Useful Commands

### Docker Commands

```bash
# View RabbitMQ logs
docker logs -f wh-rabbitmq

# Execute command inside container
docker exec wh-rabbitmq rabbitmq-diagnostics <command>

# List queues
docker exec wh-rabbitmq rabbitmq-diagnostics queues

# List exchanges
docker exec wh-rabbitmq rabbitmq-diagnostics exchanges

# List bindings
docker exec wh-rabbitmq rabbitmq-diagnostics bindings

# Purge queue
docker exec wh-rabbitmq rabbitmqctl purge_queue <queue_name>

# List connections
docker exec wh-rabbitmq rabbitmq-diagnostics connections
```

### Management UI Operations

1. **Create Exchange**:
   - Navigate to "Exchanges" tab
   - Click "Add a new exchange"
   - Name: `events.topic`
   - Type: `topic`
   - Durable: ✓

2. **Create Queue**:
   - Navigate to "Queues" tab
   - Click "Add a new queue"
   - Name: `notification.queue`
   - Type: `Classic`
   - Durable: ✓
   - Arguments:
     - `x-dead-letter-exchange`: `dlx`
     - `x-dead-letter-routing-key`: `notifications.dead-letter`

3. **Create Binding**:
   - Go to Exchange → `events.topic`
   - Add binding to queue
   - Queue name: `events.order.created`
   - Routing key: `events.order.created`

## Message Format

### Event Message (ingestion queue)

```json
{
  "eventID": "uuid-v4",
  "clientID": "uuid-v4",
  "eventType": "order.created",
  "payload": {
    "orderId": "12345",
    "amount": 99.99,
    "status": "created"
  },
  "timestamp": "2026-01-07T10:00:00Z",
  "hmacSignature": "base64-encoded-signature"
}
```

### Notification Message (notification queue)

```json
{
  "notificationID": "uuid-v4",
  "eventID": "uuid-v4",
  "subscriptionID": 123,
  "subscriberClientID": "uuid-v4",
  "webhookEndpoint": "https://subscriber.com/webhook",
  "encryptedPayload": "base64-encoded-ciphertext",
  "hmacSignature": "base64-encoded-signature",
  "timestamp": "2026-01-07T10:00:00Z",
  "retryCount": 0,
  "metadata": {
    "eventType": "order.created",
    "publisherClientID": "uuid-v4"
  }
}
```

## Monitoring & Troubleshooting

### Check Queue Depth

```bash
# Via Management UI
# Queues tab → click queue name → see "Messages ready"

# Via CLI
docker exec wh-rabbitmq rabbitmq-diagnostics queues | grep notification.queue
```

### Check Consumer Status

```bash
docker exec wh-rabbitmq rabbitmq-diagnostics consumers

# Or via Management UI:
# Queues tab → click queue → see "Consumers" section
```

### Purge Queue (Delete All Messages)

```bash
# WARNING: This deletes all messages in queue!
docker exec wh-rabbitmq rabbitmqctl purge_queue notification.queue
```

### Check Memory Usage

```bash
docker exec wh-rabbitmq rabbitmq-diagnostics memory_breakdown
```

### Restart RabbitMQ

```bash
docker restart wh-rabbitmq
```

## Performance Tuning

### Adjust Consumer Prefetch

Lower prefetch = Better distribution of messages across consumers
Higher prefetch = Higher throughput

```yaml
spring:
  rabbitmq:
    listener:
      simple:
        prefetch: 10  # Tune based on message processing time
```

### Adjust Concurrency

```yaml
spring:
  rabbitmq:
    listener:
      simple:
        concurrency: 5          # Minimum threads
        max-concurrency: 20     # Maximum threads
```

### Enable Lazy Queue

For very high message volumes:

```bash
# Set via Management UI or rabbitmqctl:
docker exec wh-rabbitmq rabbitmqctl set_policy lazy-queue \
  ".*" '{"queue-mode":"lazy"}' \
  --apply-to queues
```

## Persistence & Data

### Data Persistence

RabbitMQ data is stored in Docker volume `rabbitmq-data`:
```bash
# View volume
docker volume ls | grep rabbitmq

# Inspect volume
docker volume inspect wh-rabbitmq-rabbitmq-data
```

### Backup

```bash
# Export RabbitMQ definitions
docker exec wh-rabbitmq rabbitmqctl export_definitions /tmp/definitions.json
docker cp wh-rabbitmq:/tmp/definitions.json ./rabbitmq-backup.json
```

### Restore

```bash
docker cp ./rabbitmq-backup.json wh-rabbitmq:/tmp/definitions.json
docker exec wh-rabbitmq rabbitmqctl import_definitions /tmp/definitions.json
docker restart wh-rabbitmq
```

## Security

### Current Setup (Development)

- Default credentials: webhooks_user / webhooks_pass
- Virtual host: / (default)
- Network: webhooks-network (internal to Docker)

### Production Recommendations

1. Change default password
2. Create separate users per service
3. Restrict access to specific vhosts
4. Enable SSL/TLS
5. Set resource limits
6. Enable management plugin authentication

## Links

- [RabbitMQ Official Documentation](https://www.rabbitmq.com/documentation.html)
- [AMQP 0-9-1 Specification](https://www.rabbitmq.com/amqp-0-9-1-quickref.html)
- [Spring AMQP Documentation](https://docs.spring.io/spring-amqp/reference/)
- [Topic Exchange Tutorial](https://www.rabbitmq.com/tutorials/tutorial-five-python.html)

