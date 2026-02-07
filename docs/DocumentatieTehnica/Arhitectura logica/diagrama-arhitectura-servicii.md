# Diagrama Arhitectură Servicii (Implementare Reală)

**Ultima actualizare:** 7 februarie 2026  
**Status:** ✅ Arhitectură implementată și funcțională

## Arhitectură Implementată (Februarie 2026)

```mermaid
flowchart TB
    subgraph "Client Layer"
        FE[wh-client-frontend<br/>React + Vite<br/>Port: 5171-5173]
        BE[wh-client-backend<br/>Node.js + Express<br/>Port: 3000-3002]
    end

    subgraph "API Gateway Layer"
        GW[wh-svc-gateway<br/>Spring Cloud Gateway<br/>Port: 8081]
    end

    subgraph "Business Logic Layer"
        MGR[wh-svc-manager<br/>Spring Boot<br/>Port: 8082]
        SEC[wh-svc-security<br/>Spring Boot<br/>Port: 8080]
    end

    subgraph "Infrastructure Layer"
        MQ[(RabbitMQ<br/>Port: 5672)]
        DB[(PostgreSQL<br/>Port: 5432)]
        REDIS[(Redis<br/>Port: 6379)]
    end

    %% Frontend to Backend
    FE --WebSocket --> BE
    FE --HTTP REST--> BE

    %% Backend to Gateway
    BE --HTTP REST--> GW
    BE --AMQP Consumer--> MQ

    %% Gateway routing
    GW --Enrollment<br/>Event Types<br/>Subscriptions--> MGR
    GW --Crypto Ops--> SEC

    %% Manager to Infrastructure
    MGR --CRUD Operations--> DB
    MGR --Cache Keys--> REDIS
    MGR --Publish Messages--> MQ

    %% RabbitMQ to Client Backend
    MQ --Consume<br/>Queue per Client--> BE

    %% Gateway to Infrastructure
    GW --Rate Limiting--> REDIS

    style FE fill:#e1f5ff
    style BE fill:#e1f5ff
    style GW fill:#fff3e0
    style MGR fill:#f3e5f5
    style SEC fill:#f3e5f5
    style MQ fill:#e8f5e9
    style DB fill:#e8f5e9
    style REDIS fill:#e8f5e9
```

## Flux Principal de Date

### 1. Enrollment Client (2-Phase)
```
Client → Backend → Gateway → Manager → Security (generate keys) → PostgreSQL
```

### 2. Publicare Eveniment
```
Client Frontend → Backend (encrypt) → Gateway → Manager (process) → RabbitMQ
```

### 3. Distribuire Mesaj către Subscriberi
```
RabbitMQ → Client Backend (decrypt) → Socket.IO → Client Frontend (display)
```

---

## Componente Implementate

| Componentă | Port | Tehnologie | Rol |
|------------|------|------------|-----|
| **wh-client-frontend** | 5171-5173 | React 19 + Vite | UI pentru management evenimente |
| **wh-client-backend** | 3000-3002 | Node.js + Express | BFF + RabbitMQ consumer |
| **wh-svc-gateway** | 8081 | Spring Cloud Gateway | Routing + Rate limiting |
| **wh-svc-manager** | 8082 | Spring Boot 3.x | Business logic + RabbitMQ publisher |
| **wh-svc-security** | 8080 | Spring Boot 3.x | Servicii criptografice |
| **RabbitMQ** | 5672, 15672 | RabbitMQ 3.13 | Message broker (Topic Exchange) |
| **PostgreSQL** | 5432 | PostgreSQL 16 | Persistență date |
| **Redis** | 6379 | Redis 7 | Cache + Rate limiting |

---

## Arhitectură RabbitMQ (Detaliu)

```mermaid
flowchart LR
    subgraph "Publisher"
        P[wh-svc-manager<br/>Java Publisher]
    end

    subgraph "RabbitMQ Broker"
        EX[Exchange: webhook.events<br/>Type: Topic]
        Q1[Queue: queue.client.A]
        Q2[Queue: queue.client.B]
        Q3[Queue: queue.client.C]
    end

    subgraph "Consumers"
        C1[wh-client-backend A<br/>Node.js Consumer]
        C2[wh-client-backend B<br/>Node.js Consumer]
        C3[wh-client-backend C<br/>Node.js Consumer]
    end

    P --webhook.client.A--> EX
    P --webhook.client.B--> EX
    P --webhook.client.C--> EX
    
    EX --Binding--> Q1
    EX --Binding--> Q2
    EX --Binding--> Q3
    
    Q1 --> C1
    Q2 --> C2
    Q3 --> C3

    style P fill:#f3e5f5
    style EX fill:#fff3e0
    style Q1 fill:#e8f5e9
    style Q2 fill:#e8f5e9
    style Q3 fill:#e8f5e9
    style C1 fill:#e1f5ff
    style C2 fill:#e1f5ff
    style C3 fill:#e1f5ff
```

**Routing:** Un message publicat cu routing key `webhook.client.B` este livrat doar în `queue.client.B`

---

## Diferențe față de Arhitectura Planificată Inițial

### ❌ Componente NU Implementate (din plan inițial)

- **Event Ingestion Service** - funcționalitatea este integrată în `wh-svc-manager`
- **Event Dispatcher Workers** - delivery se face prin Socket.IO real-time
- **Notification Service** - alerting se face prin toast notifications în UI
- **Subscriber Endpoint** - nu există HTTP webhooks externe, doar Socket.IO intern

### ✅ Componente Adiționale Implementate

- **wh-client-frontend** - aplicație React completă cu UI
- **wh-client-backend** - BFF pattern pentru proxy și messaging
- **Socket.IO** - real-time communication între backend și frontend

### 🎯 Motivație Schimbări

1. **Simplitate MVP** - implementare mai rapidă fără componente separate
2. **Real-time UX** - Socket.IO oferă experiență superioară vs polling HTTP
3. **Reducere complexitate** - mai puține servicii de întreținut
4. **Time-to-market** - delivery funcționalitate core în 6 săptămâni

---

## Metrici Arhitectură

**Latență end-to-end:** < 500ms (P95)  
**Throughput:** ~100 mesaje/secundă (actual)  
**Disponibilitate:** 99.5% (limited de single instance RabbitMQ/PostgreSQL)  
**Scalabilitate:** Servicii containerizate, gata pentru scaling orizontal

---


