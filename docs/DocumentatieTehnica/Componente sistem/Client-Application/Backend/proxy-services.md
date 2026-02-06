# Proxy Services - Backend BFF

## Prezentare Generală

Backend-ul Node.js funcționează ca un **Backend For Frontend (BFF)**, oferind un layer de proxy între Frontend (React) și microserviciile Java (wh-security și wh-svc-gateway). Acest document descrie implementarea completă a rutelor și controllers pentru proxy.

---

## Arhitectură Proxy

```
Frontend (React)
    ↓ HTTP Request
Backend BFF (Node.js Express)
    ├─► /api/security/*  → wh-security:8080
    └─► /api/gateway/*   → wh-svc-gateway:8081
        ↓ Axios HTTP
Java Microservices (Spring Boot)
    ↓ Response
Backend BFF (format + broadcast WebSocket)
    ↓
Frontend (HTTP response + WebSocket event)
```

---

## Security Service Proxy

### Endpoint: `wh-security` (Port 8080)
**Scop:** Servicii de criptare, decriptare și gestionare chei

### Routes: `routes/securityRoutes.js`

| Metodă | Endpoint BFF | Proxy către | Descriere |
|--------|--------------|-------------|-----------|
| POST | /api/security/encrypt | /api/security/encrypt | Criptare date |
| POST | /api/security/decrypt | /api/security/decrypt | Decriptare date |
| POST | /api/security/generate-keypair | /api/security/generate-keypair | Generare chei RSA |
| GET | /api/security/public-key/:clientId | /api/security/public-key/:clientId | Obținere cheie publică |
| POST | /api/security/sign | /api/security/sign | Semnare digitală |
| POST | /api/security/verify | /api/security/verify | Verificare semnătură |

### Controller: `controllers/securityController.js`

#### encrypt(req, res, next)
**Scop:** Criptează date folosind cheia publică

**Request Body:**
```json
{
  "data": "text sensibil",
  "publicKey": "-----BEGIN PUBLIC KEY-----\n..."
}
```

**Implementare:**
```javascript
encrypt: async (req, res, next) => {
  try {
    const { data, publicKey } = req.body;
    
    const response = await axios.post(
      `${config.SECURITY_SVC_URL}/api/security/encrypt`,
      { data, publicKey }
    );
    
    res.json(response.data);
  } catch (error) {
    next(error); // Propagare către errorHandler
  }
}
```

**Response:**
```json
{
  "success": true,
  "encryptedData": "base64encodedstring..."
}
```

#### decrypt(req, res, next)
**Scop:** Decriptează date folosind cheia privată

**Request Body:**
```json
{
  "encryptedData": "base64encodedstring...",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n..."
}
```

#### generateKeyPair(req, res, next)
**Scop:** Generează pereche chei RSA (publică + privată)

**Request Body:**
```json
{
  "clientId": 123,
  "keySize": 2048
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
    "privateKey": "-----BEGIN PRIVATE KEY-----\n...",
    "keySize": 2048,
    "algorithm": "RSA"
  }
}
```

---

## Gateway Service Proxy

### Endpoint: `wh-svc-gateway` (Port 8081)
**Scop:** Gestionare clienți și webhook-uri

### Routes: `routes/gatewayRoutes.js`

#### Client Management Routes

| Metodă | Endpoint BFF | Proxy către | Descriere |
|--------|--------------|-------------|-----------|
| POST | /api/gateway/clients/register | /api/clients/register | Înregistrare client |
| GET | /api/gateway/clients/check-name | /api/clients/check-name | Verificare nume |
| GET | /api/gateway/clients/:clientId | /api/clients/:clientId | Detalii client |
| PUT | /api/gateway/clients/:clientId | /api/clients/:clientId | Actualizare client |
| DELETE | /api/gateway/clients/:clientId | /api/clients/:clientId | Ștergere client |
| GET | /api/gateway/clients | /api/clients | Listă clienți (paginat) |

#### Webhook Subscription Routes

| Metodă | Endpoint BFF | Proxy către | Descriere |
|--------|--------------|-------------|-----------|
| POST | /api/gateway/webhooks/subscribe | /api/webhooks/subscribe | Creare subscriere |
| GET | /api/gateway/webhooks/subscriptions | /api/webhooks/subscriptions | Listă subscripții |
| GET | /api/gateway/webhooks/subscriptions/:id | /api/webhooks/subscriptions/:id | Detalii subscriere |
| PUT | /api/gateway/webhooks/subscriptions/:id | /api/webhooks/subscriptions/:id | Actualizare |
| DELETE | /api/gateway/webhooks/subscriptions/:id | /api/webhooks/subscriptions/:id | Ștergere |
| POST | /api/gateway/webhooks/subscriptions/:id/test | /api/webhooks/subscriptions/:id/test | Test webhook |

#### Webhook Events Routes

| Metodă | Endpoint BFF | Proxy către | Descriere |
|--------|--------------|-------------|-----------|
| GET | /api/gateway/webhooks/events | /api/webhooks/events | Istoric (paginat) |
| GET | /api/gateway/webhooks/events/:eventId | /api/webhooks/events/:eventId | Detalii eveniment |
| POST | /api/gateway/webhooks/events/:eventId/retry | /api/webhooks/events/:eventId/retry | Retry webhook |
| GET | /api/gateway/webhooks/stats | /api/webhooks/stats | Statistici |

---

## Gateway Controller Implementation

### Fișier: `controllers/gatewayController.js`

### registerClient(req, res, next)
**Scop:** Înregistrare client + broadcasting WebSocket

**Request Body:**
```json
{
  "clientName": "MyCompany",
  "email": "admin@mycompany.com",
  "callbackUrl": "https://mycompany.com/webhook"
}
```

**Implementare:**
```javascript
registerClient: async (req, res, next) => {
  try {
    const { clientName, email, callbackUrl } = req.body;
    
    // Proxy către Java service
    const response = await axios.post(
      `${config.GATEWAY_SVC_URL}/api/clients/register`,
      { clientName, email, callbackUrl }
    );
    
    // Broadcast WebSocket event
    if (req.app.get('io')) {
      broadcastMessage(req.app.get('io'), 'client-registered', {
        clientId: response.data.data?.clientId,
        clientName: clientName
      });
    }
    
    res.json(response.data);
  } catch (error) {
    next(error);
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Client înregistrat cu succes",
  "data": {
    "clientId": 123,
    "apiKey": "sk_live_abc123..."
  }
}
```

**WebSocket Event Broadcast:**
```javascript
{
  "clientId": 123,
  "clientName": "MyCompany",
  "timestamp": "2026-02-06T10:00:00Z"
}
```

### retryWebhook(req, res, next)
**Scop:** Reîncercare webhook eșuat + notificare real-time

**Implementare:**
```javascript
retryWebhook: async (req, res, next) => {
  try {
    const { eventId } = req.params;
    
    const response = await axios.post(
      `${config.GATEWAY_SVC_URL}/api/webhooks/events/${eventId}/retry`
    );
    
    // Notificare WebSocket
    if (req.app.get('io')) {
      broadcastMessage(req.app.get('io'), 'webhook-retry', {
        eventId: eventId,
        status: 'RETRYING'
      });
    }
    
    res.json(response.data);
  } catch (error) {
    next(error);
  }
}
```

---

## Error Handling în Proxy

### Gestionare Erori Axios

Când serviciul Java returnează eroare, controller-ul propagă eroarea către middleware `errorHandler.js`:

```javascript
try {
  const response = await axios.post(JAVA_URL, data);
  res.json(response.data);
} catch (error) {
  // error.response = răspunsul de la Java
  // error.response.status = 400, 404, 500, etc.
  // error.response.data = body-ul erorii de la Java
  
  next(error); // Propagare către errorHandler
}
```

### Error Handler Middleware

**Fișier:** `middleware/errorHandler.js`

```javascript
function errorHandler(err, req, res, next) {
  // Extrage status și mesaj din eroarea Axios
  const statusCode = err.response?.status || 500;
  const message = err.response?.data?.message || 'Eroare internă server';
  
  // Răspuns uniform
  res.status(statusCode).json({
    success: false,
    message: message,
    timestamp: new Date().toISOString()
  });
}
```

**Exemplu eroare de la Java:**
```json
// Java returnează 404
{
  "status": 404,
  "message": "Client nu a fost găsit",
  "timestamp": "2026-02-06T10:00:00"
}
```

**BFF formatează și returnează:**
```json
{
  "success": false,
  "message": "Client nu a fost găsit",
  "timestamp": "2026-02-06T10:00:00Z"
}
```

---

## WebSocket Integration în Controllers

### Acces la Socket.io Instance

În `index.js`, instanța `io` este expusă prin Express app:

```javascript
app.set('io', io);
```

În controllers, accesăm prin `req.app.get('io')`:

```javascript
if (req.app.get('io')) {
  broadcastMessage(req.app.get('io'), 'event-name', data);
}
```

### Broadcasting Events

**Funcție helper:** `socket/socketHandler.js`

```javascript
function broadcastMessage(io, eventName, data) {
  io.emit(eventName, {
    ...data,
    timestamp: new Date().toISOString()
  });
}
```

**Exemplu utilizare:**
```javascript
broadcastMessage(io, 'client-registered', {
  clientId: 123,
  clientName: 'MyCompany'
});
```

**Clienții Frontend primesc:**
```javascript
socket.on('client-registered', (data) => {
  console.log('Client nou:', data.clientName);
  // UI update automat
});
```

---

## Configuration Management

### Environment Variables

**Fișier:** `config/envConfig.js`

```javascript
const config = {
  SECURITY_SVC_URL: process.env.SECURITY_SVC_URL || 'http://localhost:8080',
  GATEWAY_SVC_URL: process.env.GATEWAY_SVC_URL || 'http://localhost:8081'
};
```

**Utilizare în controllers:**
```javascript
const config = require('../config/envConfig');

axios.post(`${config.GATEWAY_SVC_URL}/api/clients/register`, data);
```

---

## Request/Response Flow

### Flow Complet: Înregistrare Client

```
1. Frontend
   └─► registerService.registerClient({...})

2. Axios HTTP
   └─► POST http://localhost:3000/api/gateway/clients/register

3. Backend BFF (Express)
   └─► gatewayRoutes.js
       └─► gatewayController.registerClient()

4. Backend → Java (Axios)
   └─► POST http://localhost:8081/api/clients/register

5. Java Processing
   └─► wh-svc-gateway → wh-svc-manager
       └─► Database insert, API key generation

6. Java Response → BFF
   └─► { success: true, data: { clientId: 123, apiKey: "..." } }

7. BFF Broadcasting
   └─► io.emit('client-registered', { clientId: 123, clientName: "..." })

8. BFF HTTP Response → Frontend
   └─► { success: true, data: {...} }

9. Frontend Updates
   ├─► HTTP response handler: UI update cu date
   └─► WebSocket event handler: Notificare Snackbar
```

**Timp total:** ~500-1000ms (HTTP) + instant (WebSocket)

---

## Testing Proxy Endpoints

### Test 1: Security Service - Encrypt
```bash
curl -X POST http://localhost:3000/api/security/encrypt \
  -H "Content-Type: application/json" \
  -d '{
    "data": "secret text",
    "publicKey": "-----BEGIN PUBLIC KEY-----..."
  }'
```

### Test 2: Gateway Service - Register Client
```bash
curl -X POST http://localhost:3000/api/gateway/clients/register \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "TestClient",
    "email": "test@example.com",
    "callbackUrl": "https://example.com/webhook"
  }'
```

### Test 3: Webhook Events - Get History
```bash
curl "http://localhost:3000/api/gateway/webhooks/events?clientId=123&page=1&pageSize=20"
```

---

## Best Practices

### 1. **Consistent Error Handling**
- Toate controllers folosesc try-catch
- Propagare uniformă către errorHandler
- Logging pentru debugging

### 2. **Configuration from ENV**
- URL-uri servicii din variabile ENV
- Ușor de schimbat pentru dev/staging/prod

### 3. **WebSocket Notifications**
- Broadcasting pentru evenimente importante
- Frontend primește feedback instant
- Îmbunătățește UX

### 4. **Separation of Concerns**
- Routes = definire endpoints
- Controllers = business logic
- Services = logică reutilizabilă (dacă e nevoie)

### 5. **JSDoc Documentation**
- Toate rutele și metodele documentate
- Ușor de înțeles pentru developeri noi

---

## Performance Considerations

### 1. **Timeout Configuration**
Axios în controllers ar trebui să aibă timeout configurat:

```javascript
const response = await axios.post(url, data, {
  timeout: 10000 // 10 secunde
});
```

### 2. **Connection Pooling**
Axios refolosește conexiuni HTTP automat (keep-alive).

### 3. **Error Recovery**
Middleware errorHandler gestionează toate erorile uniform.

### 4. **WebSocket Broadcasting**
`io.emit()` este non-blocking, nu întârzie response-ul HTTP.

---

## Future Enhancements

- [ ] Request caching pentru GET calls frecvente
- [ ] Retry logic pentru failed requests către Java
- [ ] Circuit breaker pattern pentru servicii down
- [ ] Rate limiting per client
- [ ] Request/response logging în fișier
- [ ] Metrics collection (request duration, error rate)
- [ ] Health checks periodice către serviciile Java

---

**Versiune documentație:** 1.0  
**Data:** 06 Februarie 2026  
**Ultima actualizare:** Etapa 3 - Proxy Services implementat complet
