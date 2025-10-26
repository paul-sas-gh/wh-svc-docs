---
id: api-gateway
slug: /DocumentatieTehnica/Componente sistem/api-gateway
title: API Gateway
---

# API Gateway

Api Gateway este un serviciu care va facilita toate comunicatiile aplicatiei cu alte aplicatii. Va prezenta atât metode de ingestie a datelor cât și metode de expunere a datelor.

**Notă:**
API Gateway publică doar endpoint-urile disponibile către alte servicii, dar nu conține logica de aplicație (ex: generare chei private și publice, salvarea în baze de date etc.). De această logică se ocupă celelalte servicii din arhitectură (Webhook Management Service, Event Ingestion Service, Event Dispatcher etc.).

---

## Caracteristici Tehnice

### Tehnologii
- **Spring Cloud Gateway 3.x** - Framework reactive pentru API Gateway (WebFlux, non-blocking)
- **Spring Boot 2.7.x** - Framework de bază pentru aplicație
- **Spring Security** - Autentificare și autorizare
- **Resilience4j** - Circuit breaker, rate limiting, retry logic
- **Redis** - Caching distribuit și rate limiting
- **Micrometer** - Metrici și monitoring
- **JWT** - Token-uri pentru autentificare

### Funcționalități Principale

#### 1. Routing & Load Balancing
- Rutare centralizată către microserviciile backend
- Load balancing între instanțe multiple
- Service discovery pentru găsirea automată a serviciilor

#### 2. Securitate
- Validare JWT pentru request-uri autentificate
- Rate limiting per client/endpoint
- CORS configuration
- Integrare cu `wh-svc-security` pentru criptare/decriptare

#### 3. Resilience
- Circuit breaker pentru servicii indisponibile
- Retry logic cu exponential backoff
- Timeout management
- Fallback responses

#### 4. Monitoring & Logging
- Logging centralizat cu correlation ID
- Metrici de performanță (latență, throughput, error rate)
- Health checks pentru servicii backend
- Request/response tracing

#### 5. Caching
- Cache răspunsuri frecvente (configurații, metadate)
- Cache invalidation strategies
- Integrare Redis pentru cache distribuit

#### 6. Fallback Mechanism
- **FallbackController** - Gestionează răspunsuri alternative când serviciile backend sunt indisponibile
- Circuit breaker detectează eșecuri repetate și redirecționează către fallback
- Răspunsuri graceful degradation pentru o experiență mai bună
- Exemple de fallback:
  - `/fallback/security` - Răspuns când Security Service este down
  - Status HTTP 503 (Service Unavailable) cu mesaj descriptiv
  - Previne cascade failures în sistem

**Cum funcționează:**
1. Gateway încearcă să apeleze serviciul backend
2. Dacă serviciul eșuează (timeout, error, sau circuit deschis)
3. Circuit breaker redirecționează request-ul către endpoint-ul de fallback
4. FallbackController returnează un răspuns JSON cu eroare user-friendly
5. Clientul primește răspuns imediat în loc să aștepte timeout

**Exemplu fallback response:**
```json
{
  "error": "Security Service is currently unavailable. Please try again later."
}
```

### Port & Deployment
- **Port**: 8081 (HTTP)
- **Context Path**: `/api`
- **Health Check**: `/actuator/health`
- **Metrics**: `/actuator/metrics`
- **Swagger UI**: http://localhost:8081/swagger-ui.html
- **OpenAPI Docs**: http://localhost:8081/v3/api-docs

### Autentificare
- **Username**: `admin`
- **Password**: `1=rMji]X?J`
- Autentificare Basic Authentication pentru toate endpoint-urile

---

## Endpoint-uri Publice

Primul endpoint va facilita înregistrarea unui client.

**Endpoint:**
```
GET /register-client
```

**Descriere:**
Acest endpoint permite înregistrarea unui client nou. Apelul se face prin metoda GET, fără niciun parametru.

**Răspuns:**
La fiecare apel, serverul va genera și returna o cheie publică unică pentru clientul respectiv. Această cheie va fi folosită de client pentru criptarea informațiilor transmise ulterior către sistem.

**Exemplu răspuns:**

```json
{
	"publicKey": "<cheie_publica_generata>"
}
```

---

## Endpoint: Înregistrare aplicație client

**Endpoint:**
```
POST /register-app
```

**Descriere:**
Acest endpoint permite crearea unei înregistrări pentru aplicația client în sistemul dezvoltat.


**Payload:**
Payload-ul transmis către endpoint va fi un string criptat, nu un obiect JSON. Structura datelor înainte de criptare este următoarea:

```json
{
	"nume_aplicatie": "<nume_aplicatie>",
	"clientPublicKey": "<cheie_publica_client>"
}
```

Acest JSON va fi serializat și criptat cu cheia publică primită la apelul anterior (`/register-client`).

**Exemplu payload transmis:**
```
<string_criptat_cu_cheia_publica_primita>
```

**Răspuns:**
La succes, serverul va returna status 200. Răspunsul va fi un string criptat, nu un obiect JSON. Structura datelor înainte de criptare este următoarea:

```json
{
    "appPublicKey": "<cheie_publica_noua>",
    "username":"<nume_app.user>",
    "password":"<random_strong_password>"
}
```


Acest JSON va fi serializat și criptat cu cheia publică primită de la client în payload.

**Exemplu răspuns transmis:**
```
<json_criptat_cu_cheia_publica_clientului>
```

---

**Reguli de criptare/decriptare pentru comunicare:**

- Toate mesajele primite de aplicația client trebuie decriptate cu cheia privată `clientPrivateKey`.
- Toate mesajele trimise către aplicația WebHooks trebuie criptate cu cheia publică `appPublicKey` primită la înregistrare.
