---
id: docker
slug: /DocumentatieTehnica/Componente sistem/docker
title: Docker System
---

# Docker System

Docker System este componenta de orchestrare și rulare a serviciilor din ecosistemul Secure WebHooks. Permite pornirea, oprirea și monitorizarea întregului sistem într-un mediu containerizat.

## Funcționalități principale
- Orchestrare servicii cu `docker-compose`
- Rețea dedicată pentru comunicație între servicii (`webhooks-network`)
- Health check automat pentru toate containerele
- Scripturi de management (PowerShell și Bash)
- Izolare și portabilitate pentru fiecare componentă
- Volume persistente pentru date (PostgreSQL, RabbitMQ)
- Hot reload pentru dezvoltare (Node.js, React)

## Arhitectură Containere

Sistemul este compus din **8 containere** organizate în 3 categorii:

### 1. Servicii Backend (Java Spring Boot)
- **wh-svc-security** (port 8080) - Serviciu de criptare/decriptare RSA
- **wh-svc-gateway** (port 8081) - API Gateway cu rate limiting și cache
- **wh-svc-manager** (port 8082) - Serviciu principal de management evenimente/subscripții

### 2. Aplicații Client (Node.js + React)
- **wh-client1** (ports 5171:5173, 3001:3000) - Client Publisher/Subscriber #1
- **wh-client2** (ports 5172:5173, 3002:3000) - Client Publisher/Subscriber #2
- **wh-client4** (ports 5174:5173, 3004:3000) - Client Publisher/Subscriber #4

### 3. Infrastructură
- **wh-postgres** (port 5432) - Bază de date PostgreSQL 16
- **wh-redis** (port 6379) - Cache Redis 7.4
- **wh-rabbitmq** (ports 5672, 15672) - Message broker RabbitMQ 3.13

## Diagramă de Flux - Interacțiuni Containere

```mermaid
flowchart TB
    subgraph "Clienți (Node.js + React)"
        C1[wh-client1<br/>:3001, :5171]
        C2[wh-client2<br/>:3002, :5172]
        C4[wh-client4<br/>:3004, :5174]
    end

    subgraph "Servicii Backend (Java)"
        SEC[wh-svc-security<br/>:8080<br/>Criptare RSA]
        GW[wh-svc-gateway<br/>:8081<br/>API Gateway]
        MGR[wh-svc-manager<br/>:8082<br/>Manager Principal]
    end

    subgraph "Infrastructură"
        PG[(wh-postgres<br/>:5432<br/>PostgreSQL)]
        RD[(wh-redis<br/>:6379<br/>Redis Cache)]
        RMQ[wh-rabbitmq<br/>:5672, :15672<br/>Message Broker]
    end

    %% Conexiuni Clienți -> Gateway
    C1 -->|HTTP REST API| GW
    C2 -->|HTTP REST API| GW
    C4 -->|HTTP REST API| GW

    %% Conexiuni Clienți -> Security
    C1 -->|Criptare/Decriptare| SEC
    C2 -->|Criptare/Decriptare| SEC
    C4 -->|Criptare/Decriptare| SEC

    %% Conexiuni Clienți -> RabbitMQ
    C1 <-->|AMQP Subscribe<br/>Consume Messages| RMQ
    C2 <-->|AMQP Subscribe<br/>Consume Messages| RMQ
    C4 <-->|AMQP Subscribe<br/>Consume Messages| RMQ

    %% Conexiuni Gateway
    GW -->|Proxy Requests| MGR
    GW -->|Criptare| SEC
    GW -->|Cache| RD

    %% Conexiuni Manager
    MGR -->|Persist Data| PG
    MGR -->|Cache Queries| RD
    MGR -->|Publish Events| RMQ
    MGR -->|Decriptare| SEC

    %% Stiluri
    classDef clientStyle fill:#e1f5ff,stroke:#0288d1,stroke-width:2px
    classDef backendStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef infraStyle fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef securityStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px

    class C1,C2,C4 clientStyle
    class GW,MGR backendStyle
    class SEC securityStyle
    class PG,RD,RMQ infraStyle
```

## Fluxuri de Date Principale

### 1. Publicare Eveniment
```
Client → Gateway (8081) → Manager (8082) → PostgreSQL + RabbitMQ
```

### 2. Consumare Mesaj
```
RabbitMQ → Client (Node.js Backend) → WebSocket → Frontend (React)
```

### 3. Criptare/Decriptare
```
Client/Gateway → Security (8080) → RSA Encryption/Decryption
```

### 4. Cache & Performance
```
Gateway → Redis (6379) → Cache API Responses
Manager → Redis (6379) → Cache Client Keys
```

## Tabel Servicii și Porturi

| Container | Tip | Porturi | Rol Principal | Dependințe |
|-----------|-----|---------|---------------|-------------|
| **wh-svc-security** | Java | 8080 | Criptare/Decriptare RSA | - |
| **wh-svc-gateway** | Java | 8081 | API Gateway, Rate Limiting | wh-svc-security, wh-redis, wh-svc-manager |
| **wh-svc-manager** | Java | 8082 | Management evenimente/subscripții | wh-postgres, wh-redis, wh-rabbitmq, wh-svc-security |
| **wh-client1** | Node+React | 3001, 5171 | Client Publisher/Subscriber | wh-svc-security, wh-svc-gateway, wh-rabbitmq |
| **wh-client2** | Node+React | 3002, 5172 | Client Publisher/Subscriber | wh-svc-security, wh-svc-gateway, wh-rabbitmq |
| **wh-client4** | Node+React | 3004, 5174 | Client Publisher/Subscriber | wh-svc-security, wh-svc-gateway, wh-rabbitmq |
| **wh-postgres** | PostgreSQL | 5432 | Bază de date persistentă | - |
| **wh-redis** | Redis | 6379 | Cache & Session Storage | - |
| **wh-rabbitmq** | RabbitMQ | 5672, 15672 | Message Broker & Management UI | - |

## Volume Persistente

```yaml
volumes:
  postgres-data:       # Date PostgreSQL
  rabbitmq-data:       # Date RabbitMQ
  rabbitmq-logs:       # Log-uri RabbitMQ
```

## Variabile de Mediu Importante

### wh-client (toate instanțele)
- `SECURITY_SVC_URL=http://wh-svc-security:8080`
- `GATEWAY_SVC_URL=http://wh-svc-gateway:8081`
- `RABBITMQ_URL=amqp://webhooks_user:webhooks_pass@wh-rabbitmq:5672`

### wh-svc-manager
- `SPRING_DATASOURCE_URL=jdbc:postgresql://wh-postgres:5432/webhooks`
- `SPRING_RABBITMQ_HOST=wh-rabbitmq`
- `SECURITY_SERVICE_URL=http://wh-svc-security:8080`

### wh-svc-gateway
- `SPRING_DATA_REDIS_HOST=wh-redis`
- `MANAGER_SERVICE_URL=http://wh-svc-manager:8082`
- `SECURITY_SERVICE_URL=http://wh-svc-security:8080`

## Structură directoare
```
wh-docker-system/
├── docker-compose.yml     # Orchestrare servicii
├── manage.ps1             # Script PowerShell management
├── manage.sh              # Script Bash management
├── .env.example           # Template variabile mediu
├── README.md              # Documentație detaliată
└── QUICK-START.md         # Ghid rapid
```

## Comenzi uzuale

### Build și pornire toate serviciile
```bash
cd wh-docker-system
docker-compose up -d --build
```

### Pornire servicii specifice
```bash
# Doar infrastructură
docker-compose up -d wh-postgres wh-redis wh-rabbitmq

# Doar backend services
docker-compose up -d wh-svc-security wh-svc-gateway wh-svc-manager

# Doar un client specific
docker-compose up -d wh-client1
```

### Rebuild unui singur serviciu
```bash
docker-compose up -d --build wh-client1
```

### Oprire servicii
```bash
# Oprește toate serviciile
docker-compose down

# Oprește și șterge volume-urile (ATENȚIE: șterge datele!)
docker-compose down -v
```

### Status și logs
```bash
# Status toate containerele
docker-compose ps

# Logs toate serviciile (live)
docker-compose logs -f

# Logs serviciu specific
docker-compose logs -f wh-svc-manager

# Ultimele 100 linii din logs
docker-compose logs --tail=100 wh-client1
```

### Health Check și Debugging
```bash
# Verifică health status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Intră în container pentru debugging
docker exec -it wh-svc-manager /bin/bash

# Verifică network
docker network inspect webhooks-network

# Verifică volume-uri
docker volume ls | grep webhooks
```

### Management rapid (Windows)
```powershell
# Build & start toate serviciile
.\manage.ps1 build

# Status servicii
.\manage.ps1 status

# Logs live
.\manage.ps1 logs

# Oprește toate serviciile
.\manage.ps1 down

# Restart un serviciu specific
.\manage.ps1 restart wh-client1
```

### Management rapid (Linux/Mac)
```bash
# Build & start
./manage.sh build

# Status
./manage.sh status

# Logs
./manage.sh logs

# Stop
./manage.sh down

# Restart serviciu specific
./manage.sh restart wh-svc-manager
```

## Adăugare serviciu nou
1. Creează `Dockerfile` în directorul serviciului
2. Adaugă serviciul în `docker-compose.yml` cu:
   - Build context și dockerfile
   - Porturi expuse
   - Environment variables
   - Networks: `webhooks-network`
   - Dependencies (dacă există)
   - Health check
3. Rulează `docker-compose up -d --build <nume-serviciu>`

## Recomandări și Best Practices

### Securitate
- ✅ Folosește `.env` pentru variabile de mediu sensibile (parole, keys)
- ✅ Nu commit-a fișiere `.env` în repository
- ✅ Schimbă parolele default în producție
- ✅ Limitează accesul la porturile expuse

### Performance
- ✅ Alocă memorie Java corespunzător (JAVA_OPTS)
- ✅ Monitorizează health check-urile pentru fiecare container
- ✅ Folosește volume-uri pentru date persistente
- ✅ Configurează Redis pentru cache eficient

### Dezvoltare
- ✅ Folosește hot reload pentru Node.js și React (volume mounts)
- ✅ Verifică logs-urile frecvent: `docker-compose logs -f`
- ✅ Testează health endpoints înainte de deploy

### Mentenanță
- ✅ Curăță periodic imaginile vechi:
  ```bash
  docker image prune -a
  docker volume prune
  ```
- ✅ Backup-ează volume-urile PostgreSQL și RabbitMQ
- ✅ Monitorizează dimensiunea volume-urilor:
  ```bash
  docker system df -v
  ```

### Troubleshooting
- ❗ Dacă un container nu pornește, verifică logs: `docker logs <container-name>`
- ❗ Dacă există probleme de rețea, restart network: `docker network disconnect/connect`
- ❗ Pentru probleme de permisiuni, verifică ownership-ul volume-urilor
- ❗ Dacă PostgreSQL nu pornește, verifică dacă portul 5432 este liber

## Resurse utile
- [Documentație Docker Compose](https://docs.docker.com/compose/)

