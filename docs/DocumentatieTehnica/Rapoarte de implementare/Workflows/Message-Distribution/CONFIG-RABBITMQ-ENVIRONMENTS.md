# Ghid Configurare RabbitMQ pentru wh-client

## Diferențe între Medii

### 🏠 Mediu Local (Development fără Docker)

**Fișier:** `wh-client/backend/.env`

```env
RABBITMQ_URL=amqp://webhooks_user:webhooks_pass@localhost:5672
RABBITMQ_EXCHANGE=webhook.events
```

**Cerințe:**
- RabbitMQ instalat local SAU
- RabbitMQ container rulând cu port-forwarding: `-p 5672:5672`

**Start:**
```bash
cd C:\Projects\WebHooksProject\wh-client\backend
npm run dev
```

---

### 🐳 Mediu Docker (Production/Testing)

**Fișier:** `wh-docker-system/docker-compose.yml`

Configurația este injectată prin `environment` în serviciul `wh-client1`/`wh-client2`:

```yaml
environment:
  - RABBITMQ_URL=amqp://webhooks_user:webhooks_pass@wh-rabbitmq:5672
  - RABBITMQ_EXCHANGE=webhook.events
```

**Diferență Cheie:** Se folosește `wh-rabbitmq` (numele containerului) în loc de `localhost`.

**Dependințe:**
```yaml
depends_on:
  - wh-svc-security
  - wh-svc-gateway
  - wh-rabbitmq  # ← Asigură că RabbitMQ pornește primul
```

**Start:**
```bash
cd C:\Projects\WebHooksProject\wh-docker-system
docker-compose up -d wh-rabbitmq wh-client1 wh-client2
```

---

## Verificare Conexiune

### Log-uri de Succes

Când aplicația se conectează cu succes la RabbitMQ, veți vedea:

```
[RABBITMQ] Încercare conectare... (1/5)
[RABBITMQ] ✓ Conectat la RabbitMQ
[RABBITMQ] ✓ Canal creat
[RABBITMQ] ✓ Exchange 'webhook.events' verificat
[RABBITMQ] ✓ Queue 'queue.client.{uid}' creată
[RABBITMQ] ✓ Queue legată cu routing key: 'webhook.client.{uid}'
[RABBITMQ] 📬 Aștept mesaje în 'queue.client.{uid}'...
[RABBITMQ] ✓ Inițializare completă
[RABBITMQ] ✓ Consumer activ
```

### Log-uri de Eroare (fără RabbitMQ disponibil)

```
[RABBITMQ] ✗ Eroare conectare (încercare 1/5): connect ECONNREFUSED 127.0.0.1:5672
[RABBITMQ] Reîncerc în 2s...
...
[RABBITMQ] ✗ Eroare inițializare: Nu s-a putut conecta la RabbitMQ după 5 încercări
[RABBITMQ] Aplicația va continua fără RabbitMQ consumer
```

**Notă:** Aplicația va continua să funcționeze normal pentru celelalte funcționalități (HTTP API, Socket.IO), doar consumer-ul RabbitMQ nu va fi activ.

---

## Troubleshooting

### Problema: "ECONNREFUSED" în Docker

**Cauză:** Containerul client pornește înainte ca RabbitMQ să fie gata.

**Soluție:**
1. Verificați că `wh-rabbitmq` este în `depends_on`
2. Verificați healthcheck-ul RabbitMQ:
   ```bash
   docker-compose ps wh-rabbitmq
   ```
3. Restart container client:
   ```bash
   docker-compose restart wh-client1
   ```

### Problema: Queue nu primește mesaje

**Verificări:**
1. **Exchange există:**
   ```bash
   docker exec wh-rabbitmq rabbitmqadmin list exchanges
   ```
   Ar trebui să vedeți `webhook.events` (type: topic).

2. **Queue există și este legată:**
   ```bash
   docker exec wh-rabbitmq rabbitmqadmin list queues
   docker exec wh-rabbitmq rabbitmqadmin list bindings
   ```

3. **Routing Key corect:**
   Verificați că `wh-svc-manager` publică cu routing key: `webhook.client.{targetClientId}`

### Problema: Mesaje nu sunt decriptate

**Cauză posibilă:** Cheia privată din `client-config.json` nu corespunde cu cheia publică stocată în `wh-svc-manager`.

**Soluție:**
1. Verificați că `client-config.json` are `serverPublicKey` corect
2. Verificați log-uri pentru erori de decriptare
3. Re-generați perechea de chei dacă este necesar

---

## RabbitMQ Management UI

**URL:** http://localhost:15672

**Credentials:**
- Username: `webhooks_user`
- Password: `webhooks_pass`

**Verificări utile:**
- **Exchanges** → Verificați `webhook.events`
- **Queues** → Verificați `queue.client.{uid}`
- **Connections** → Verificați conexiunile active de la clienți

---

## Arhitectură Network

```
┌─────────────────────────────────────────────────────────┐
│  Docker Network: webhooks-network                       │
│                                                           │
│  ┌──────────────┐       ┌──────────────┐                │
│  │ wh-client1   │       │ wh-client2   │                │
│  │ (Consumer)   │       │ (Consumer)   │                │
│  └──────┬───────┘       └──────┬───────┘                │
│         │                      │                         │
│         └──────────┬───────────┘                         │
│                    │                                     │
│              ┌─────▼─────┐                               │
│              │wh-rabbitmq│                               │
│              │ (Broker)  │                               │
│              └─────▲─────┘                               │
│                    │                                     │
│            ┌───────┴────────┐                            │
│            │                │                            │
│     ┌──────▼──────┐  ┌─────▼────────┐                   │
│     │wh-svc-manager│  │ Other Pubs │                    │
│     │ (Publisher) │  │ (Future)   │                    │
│     └─────────────┘  └────────────┘                    │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Notă:** Toate containerele comunică prin numele serviciului (ex: `wh-rabbitmq`) datorită DNS-ului intern Docker.

---

**Ultima actualizare:** 2026-02-06
