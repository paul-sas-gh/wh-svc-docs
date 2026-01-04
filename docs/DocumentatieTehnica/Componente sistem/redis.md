---
id: redis
slug: /DocumentatieTehnica/Componente sistem/redis
title: Redis
---

# Redis

Descrierea rolului și funcționalității componentei Redis în arhitectura Secure WebHooks.

## Deploy Redis cu Docker Compose

Redis rulează ca serviciu Docker folosind imaginea oficială `redis:7.4.6`.

```yaml
redis:
  image: redis:7.4.6
  container_name: wh-redis
  ports:
    - "6379:6379"
  networks:
    - webhooks-network
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

## Comenzi utile pentru Redis CLI

- **Conectare la container Redis:**
  ```bash
  docker exec -it wh-redis redis-cli
  ```
- **Listare chei:**
  ```bash
  KEYS *
  ```
- **Verificare existență cheie:**
  ```bash
  EXISTS nume_cheie
  ```
- **Obținere valoare cheie:**
  ```bash
  GET nume_cheie
  ```
- **Setare cheie cu TTL:**
  ```bash
  SETEX nume_cheie 300 valoare
  ```
- **Ștergere cheie:**
  ```bash
  DEL nume_cheie
  ```
- **Ping server Redis:**
  ```bash
  PING
  ```
- **Autentificare cu parolă (dacă este configurată):**
  ```bash
  AUTH parola_ta_redis
  ```

## Resurse
- [Documentație Redis](https://redis.io/docs/)
- [Comenzi Redis CLI](https://redis.io/commands/)
