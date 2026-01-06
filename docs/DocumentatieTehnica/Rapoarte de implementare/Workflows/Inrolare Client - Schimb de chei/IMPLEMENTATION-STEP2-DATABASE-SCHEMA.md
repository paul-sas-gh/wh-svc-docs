---
sidebar_position: 3
---
# Implementare Pas 2: Schema Bază de Date

## Status: ✅ IMPLEMENTAT COMPLET

## Data implementării: 4 ianuarie 2026

## Descriere

Pasul 2 din planul de implementare pentru Faza 2 a procesului de înrolare a fost finalizat cu succes. S-a creat scriptul de migrare Flyway pentru tabelul `clients` și s-a configurat aplicația pentru a se conecta la PostgreSQL.

## Modificări efectuate

### 1. Fișier: `wh-svc-manager/pom.xml`

**Adăugate dependențe Flyway:**
```xml
<!-- Flyway Core for Database Migrations -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>

<!-- Flyway PostgreSQL -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-database-postgresql</artifactId>
</dependency>
```

**Versiuni:**
- flyway-core: 11.7.2 (managed by Spring Boot parent)
- flyway-database-postgresql: 11.7.2

### 2. Fișier: `wh-svc-manager/src/main/resources/db/migration/V1__create_clients_table.sql`

**Script de migrare SQL creat:**
- Creare tabel `clients` cu 7 coloane
- 2 indecși pentru performanță (status, created_at)
- Comentarii SQL pentru documentație

**Structură tabel:**
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
```

**Indecși:**
- `idx_clients_status` - pentru filtrare după status
- `idx_clients_created_at` - pentru sortare cronologică (DESC)

### 3. Fișier: `wh-svc-manager/src/main/resources/application.properties`

**Actualizare configurație:**

**Înlocuit H2 cu PostgreSQL:**
```properties
# Database configuration (PostgreSQL)
spring.datasource.url=jdbc:postgresql://localhost:5432/webhooks
spring.datasource.driver-class-name=org.postgresql.Driver
spring.datasource.username=webhooks_user
spring.datasource.password=webhooks_pass
```

**Configurare JPA/Hibernate:**
```properties
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.properties.hibernate.format_sql=true
```

**Configurare Flyway:**
```properties
spring.flyway.enabled=true
spring.flyway.baseline-on-migrate=true
spring.flyway.locations=classpath:db/migration
spring.flyway.validate-on-migrate=true
spring.flyway.clean-disabled=true
```

## Verificări efectuate

### 1. Build Maven
```bash
mvn clean install -DskipTests
```
✅ **Rezultat**: BUILD SUCCESS (20.117s)
- Flyway dependencies descărcate și adăugate
- Compilare 27 fișiere sursă
- JAR creat cu succes

### 2. Pornire aplicație
```bash
mvn spring-boot:run
```
✅ **Rezultat**: Aplicație pornită, migrări executate automat

### 3. Verificare tabele PostgreSQL
```bash
docker exec wh-postgres psql -U webhooks_user -d webhooks -c "\dt"
```
✅ **Rezultat**:
```
Schema | Name                   | Type  | Owner
-------+------------------------+-------+---------------
public | clients                | table | webhooks_user
public | flyway_schema_history  | table | webhooks_user
```

### 4. Verificare structură tabel
```bash
docker exec wh-postgres psql -U webhooks_user -d webhooks -c "\d clients"
```
✅ **Rezultat**: Toate coloanele, constraints și indecși creați corect:
- 7 coloane cu tipuri corecte
- Primary key pe `client_id`
- 2 indecși secundari
- Valori default pentru `status`, `created_at`, `updated_at`

### 5. Verificare istoric Flyway
```bash
SELECT version, description, type, installed_on, success FROM flyway_schema_history;
```
✅ **Rezultat**:
```
version | description           | type | installed_on              | success
--------+-----------------------+------+---------------------------+---------
1       | create clients table  | SQL  | 2026-01-04 18:13:56.53... | t
```

## Structură finală PostgreSQL

### Tabel: clients

| Coloană | Tip | Nullable | Default | Descriere |
|---------|-----|----------|---------|-----------|
| client_id | UUID | NOT NULL | - | Primary Key, identificator unic client |
| client_public_key | TEXT | NOT NULL | - | Cheia publică client (PEM format) |
| system_private_key | TEXT | NOT NULL | - | Cheia privată sistem pentru client |
| system_public_key | TEXT | NOT NULL | - | Cheia publică sistem pentru client |
| status | VARCHAR(50) | NOT NULL | 'ACTIVE' | Status: ACTIVE, SUSPENDED, INACTIVE |
| created_at | TIMESTAMP WITH TIME ZONE | NULL | CURRENT_TIMESTAMP | Data înrolării |
| updated_at | TIMESTAMP WITH TIME ZONE | NULL | CURRENT_TIMESTAMP | Data ultimei actualizări |

### Indecși

1. **clients_pkey** (PRIMARY KEY)
   - Coloană: client_id
   - Tip: btree

2. **idx_clients_status**
   - Coloană: status
   - Tip: btree
   - Scop: Filtrare rapidă după status

3. **idx_clients_created_at**
   - Coloană: created_at DESC
   - Tip: btree
   - Scop: Sortare cronologică (cele mai noi primele)

## Configurație Flyway

- **Enabled**: true
- **Baseline on migrate**: true (permite migrare pe DB existent)
- **Locations**: classpath:db/migration
- **Validate on migrate**: true (validează migrări înainte de aplicare)
- **Clean disabled**: true (protecție împotriva ștergerii accidentale)

## Flyway Schema History

Flyway menține un tabel `flyway_schema_history` care urmărește:
- Versiunea migrării
- Descriere
- Tip (SQL, Java)
- Data instalării
- Success flag
- Checksum pentru validare

## Beneficii implementare

✅ **Migrări versionate** - fiecare schimbare de schemă este urmărită  
✅ **Rollback safe** - posibilitate de revenire la versiuni anterioare  
✅ **Reproducibilitate** - aceeași schemă în dev/test/prod  
✅ **Documentație** - scripturile SQL servesc ca documentație  
✅ **Validare automată** - Flyway verifică integritatea schemei  
✅ **Team sync** - toți dezvoltatorii au aceeași schemă  

## Comenzi utile migrări

### Verificare versiune curentă
```bash
docker exec wh-postgres psql -U webhooks_user -d webhooks -c \
  "SELECT version, description FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;"
```

### Verificare toate migrările
```bash
docker exec wh-postgres psql -U webhooks_user -d webhooks -c \
  "SELECT * FROM flyway_schema_history ORDER BY installed_rank;"
```

### Verificare checksum
```bash
docker exec wh-postgres psql -U webhooks_user -d webhooks -c \
  "SELECT version, checksum, success FROM flyway_schema_history;"
```

### Repair Flyway (dacă migrare eșuată)
```bash
mvn flyway:repair
```

## Următorul pas

**Pasul 3**: Security Service - Validare endpoint-uri criptografice
- Validare endpoint `/decrypt`
- Validare endpoint `/encrypt`
- Testare end-to-end a operațiunilor criptografice

**Status**: Endpoint-urile sunt deja implementate, urmează validarea funcționalității.

## Documentație adițională

- [Flyway Documentation](https://flywaydb.org/documentation/)
- [Spring Boot Flyway Integration](https://docs.spring.io/spring-boot/docs/current/reference/html/howto.html#howto.data-initialization.migration-tool.flyway)
- [PostgreSQL Data Types](https://www.postgresql.org/docs/16/datatype.html)

---

✅ **Pasul 2 implementat cu succes! Schema PostgreSQL este operațională și gata pentru următorul pas.**

