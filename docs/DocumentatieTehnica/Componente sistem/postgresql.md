---
id: postgresql
slug: /DocumentatieTehnica/Componente sistem/postgresql
title: PostgreSQL
---

# PostgreSQL

PostgreSQL este baza de date relațională principală a sistemului Secure WebHooks, responsabilă pentru stocarea persistentă a datelor critice ale aplicației, inclusiv informații despre clienți, chei criptografice, subscripții webhook, și jurnale de livrare.

## Rol în arhitectură

PostgreSQL servește ca **sistem de stocare persistentă** pentru:

1. **Date clienți înrolați** - informații despre clienții înregistrați în sistem
2. **Chei criptografice** - chei publice și private pentru comunicare securizată
3. **Subscripții webhook** - configurări endpoint-uri și secrete pentru livrare evenimente
4. **Jurnale livrări** - istoric tentative de livrare, statusuri, și retry logic
5. **Configurări sistem** - setări și parametri aplicație

## Configurație Docker

PostgreSQL rulează ca serviciu containerizat în `wh-docker-system`:

```yaml
postgres:
  image: postgres:16-alpine
  container_name: wh-postgres
  ports:
    - "5432:5432"
  environment:
    - POSTGRES_DB=webhooks
    - POSTGRES_USER=webhooks_user
    - POSTGRES_PASSWORD=webhooks_pass
  volumes:
    - postgres-data:/var/lib/postgresql/data
  networks:
    - webhooks-network
  restart: unless-stopped
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U webhooks_user -d webhooks"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

### Parametri configurație

| Parametru | Valoare | Descriere |
|-----------|---------|-----------|
| **Imagine** | postgres:16-alpine | Versiune PostgreSQL 16 optimizată (~40MB) |
| **Container** | wh-postgres | Nume container Docker |
| **Port** | 5432 | Port expus pentru conexiuni (host și intern) |
| **Bază de date** | webhooks | Bază de date principală |
| **User** | webhooks_user | Utilizator PostgreSQL |
| **Password** | webhooks_pass | Parolă utilizator (⚠️ pentru dev, în prod se folosește secrets) |
| **Volum** | postgres-data | Persistență date între restarts |
| **Network** | webhooks-network | Rețea Docker partajată cu celelalte servicii |

## Conectare din servicii

Serviciile Spring Boot se conectează la PostgreSQL folosind JDBC:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://wh-postgres:5432/webhooks
    username: webhooks_user
    password: webhooks_pass
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
        format_sql: true
    show-sql: false
```

**Notă**: Se folosește numele containerului `wh-postgres` ca hostname în rețeaua Docker internă.

## Schema bazei de date

### Tabel: `clients`

Stochează informații despre clienții înrolați și cheile lor criptografice.

```sql
CREATE TABLE clients (
    client_id UUID PRIMARY KEY,
    client_public_key TEXT NOT NULL,
    system_private_key TEXT NOT NULL,
    system_public_key TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_created_at ON clients(created_at);
```

**Câmpuri:**
- `client_id` - Identificator unic client (UUID)
- `client_public_key` - Cheia publică a clientului (format PEM)
- `system_private_key` - Cheia privată a sistemului pentru acest client (format PEM, criptată at rest)
- `system_public_key` - Cheia publică a sistemului pentru acest client (format PEM)
- `status` - Status client: ACTIVE, SUSPENDED, INACTIVE
- `created_at` - Data înrolării
- `updated_at` - Data ultimei actualizări

### Migrări

Se folosește **Flyway** sau **Liquibase** pentru gestionarea migrărilor schemei.

Exemplu Flyway:
```
src/main/resources/db/migration/
├── V1__create_clients_table.sql
├── V2__create_subscriptions_table.sql
└── V3__create_delivery_logs_table.sql
```

## Comenzi utile

### Conectare la baza de date

```bash
# Conectare interactivă (psql)
docker exec -it wh-postgres psql -U webhooks_user -d webhooks

# Executare comandă SQL directă
docker exec wh-postgres psql -U webhooks_user -d webhooks -c "SELECT version();"
```

### Verificare status

```bash
# Status container
docker-compose ps postgres

# Health check manual
docker exec wh-postgres pg_isready -U webhooks_user -d webhooks

# Verificare loguri
docker-compose logs postgres
docker-compose logs -f postgres  # Follow mode
```

### Management date

```bash
# Listare baze de date
docker exec wh-postgres psql -U webhooks_user -d webhooks -c "\l"

# Listare tabele
docker exec wh-postgres psql -U webhooks_user -d webhooks -c "\dt"

# Descriere structură tabel
docker exec wh-postgres psql -U webhooks_user -d webhooks -c "\d clients"

# Interogare date
docker exec wh-postgres psql -U webhooks_user -d webhooks -c "SELECT * FROM clients LIMIT 10;"
```

### Backup și restore

```bash
# Backup bază de date
docker exec wh-postgres pg_dump -U webhooks_user webhooks > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore din backup
docker exec -i wh-postgres psql -U webhooks_user -d webhooks < backup_20260104_120000.sql

# Backup binar (format custom)
docker exec wh-postgres pg_dump -U webhooks_user -Fc webhooks > backup.dump

# Restore din backup binar
docker exec -i wh-postgres pg_restore -U webhooks_user -d webhooks < backup.dump
```

## Persistență date

Datele PostgreSQL sunt stocate în volumul Docker persistent `postgres-data`:

```bash
# Listare volume
docker volume ls | grep postgres

# Inspect volum
docker volume inspect wh-docker-system_postgres-data

# Locație date (în container)
/var/lib/postgresql/data
```

**Important**: 
- Volumul persistă chiar dacă containerul este șters
- Pentru ștergere completă: `docker-compose down -v`
- Backup-urile regulate sunt recomandate pentru medii de producție

## Performanță și optimizare

### Indecși

Pentru performanță optimă, se creează indecși pe câmpurile folosite frecvent în interogări:

```sql
-- Index pe status (filtru frecvent)
CREATE INDEX idx_clients_status ON clients(status);

-- Index pe date (sortări cronologice)
CREATE INDEX idx_clients_created_at ON clients(created_at DESC);

-- Index compus pentru query-uri complexe
CREATE INDEX idx_clients_status_created ON clients(status, created_at DESC);
```

### Connection pooling

Spring Boot folosește HikariCP (default) pentru connection pooling:

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 10
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
```

### Monitoring

```sql
-- Verificare conexiuni active
SELECT count(*) FROM pg_stat_activity WHERE datname = 'webhooks';

-- Detalii conexiuni
SELECT pid, usename, application_name, client_addr, state, query 
FROM pg_stat_activity 
WHERE datname = 'webhooks';

-- Statistici tabele
SELECT schemaname, tablename, n_live_tup, n_dead_tup 
FROM pg_stat_user_tables;
```

## Securitate

### Best practices

1. **Credențiale**: În producție, folosește Docker secrets sau variabile de mediu securizate
2. **SSL/TLS**: Activează conexiuni criptate pentru medii de producție
3. **Backup-uri**: Configurează backup-uri automate regulate
4. **Acces limitat**: Folosește roluri și permisiuni granulare
5. **Audit**: Activează logging pentru operațiuni critice

### Configurare SSL (producție)

```yaml
spring:
  datasource:
    url: jdbc:postgresql://wh-postgres:5432/webhooks?ssl=true&sslmode=require
```

## Troubleshooting

### Container nu pornește

```bash
# Verificare loguri
docker-compose logs postgres

# Verificare erori
docker-compose ps postgres

# Restart container
docker-compose restart postgres
```

### Probleme de conectare

```bash
# Test conexiune din exterior
docker exec wh-postgres pg_isready -U webhooks_user -d webhooks

# Verificare port
netstat -an | grep 5432

# Test conexiune din alt container
docker exec wh-svc-security nc -zv wh-postgres 5432
```

### Probleme de performanță

```sql
-- Verificare query-uri lente
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Verificare locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Vacuum și analyze
VACUUM ANALYZE clients;
```

## Versiune și compatibilitate

- **Versiune**: PostgreSQL 16.11
- **Arhitectură**: x86_64 (Linux/Alpine)
- **JDBC Driver**: org.postgresql:postgresql
- **Dialect Hibernate**: org.hibernate.dialect.PostgreSQLDialect

## Referințe

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/16/)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [Spring Data JPA Documentation](https://spring.io/projects/spring-data-jpa)
- [Flyway Documentation](https://flywaydb.org/documentation/)

## Status implementare

✅ **Container configurat și operațional** (4 ianuarie 2026)  
🔄 **Schema în dezvoltare** - tabelul `clients` în plan de implementare  
⏳ **Tabele viitoare** - subscriptions, delivery_logs, system_config
