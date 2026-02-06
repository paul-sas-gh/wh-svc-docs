# Arhitectură Backend For Frontend (BFF)

## Prezentare Generală

Backend-ul aplicației `wh-client` funcționează ca un **Backend For Frontend (BFF)**, un pattern arhitectural care oferă un strat de agregare între UI și microserviciile Java existente.

---

## Responsabilități BFF

### 1. Proxy și Agregare
- Intermediar între Frontend (React) și serviciile Java backend
- Agregare date din multiple servicii într-un singur răspuns
- Transformare și formatare date pentru nevoile specifice UI-ului

### 2. Comunicare Bidirectională
- **HTTP REST:** Request-uri sincrone de la Frontend
- **WebSocket (Socket.io):** Push notifications către Frontend în timp real

### 3. Error Handling Uniform
- Capturare erori de la serviciile Java
- Formatare consistentă a răspunsurilor de eroare
- Logging centralizat

---

## Stack Tehnologic

| Componentă | Tehnologie | Versiune | Scop |
|------------|-----------|----------|------|
| Runtime | Node.js | 18+ | Execuție JavaScript server-side |
| Framework | Express.js | 5.2.1 | Web server și routing |
| WebSocket | Socket.io | 4.8.3 | Comunicare bidirectională real-time |
| HTTP Client | Axios | 1.13.4 | Request-uri către servicii Java |
| Config | dotenv | 17.2.4 | Gestionare variabile ENV |
| Dev Tool | nodemon | 3.1.11 | Hot-reload în dezvoltare |

---

## Arhitectură Layered

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                   │
│              WebSocket + HTTP Requests               │
└─────────────────────────────────────────────────────┘
                         ▲
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              Backend BFF (Node.js)                   │
│  ┌───────────────────────────────────────────────┐  │
│  │  Express Router + Socket.io Server            │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Middleware (Logger, Error Handler, CORS)     │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Controllers (Orchestration Logic)            │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Services (Axios Proxy, Data Transform)       │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         ▲
                         │ Axios HTTP
                         ▼
┌─────────────────────────────────────────────────────┐
│         Microservicii Java (Spring Boot)             │
│  ┌──────────────────┐    ┌──────────────────────┐  │
│  │  wh-security     │    │  wh-svc-gateway      │  │
│  │  Port: 8080      │    │  Port: 8081          │  │
│  └──────────────────┘    └──────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Structură Directoare

```
backend/
├── index.js                    # Entry point, setup Express + Socket.io
├── .env                        # Variabile de mediu (nu se commitează)
├── .env.example                # Template pentru .env
├── package.json                # Dependențe și scripturi
│
├── config/
│   └── envConfig.js            # Centralizare și validare ENV variables
│
├── middleware/
│   ├── errorHandler.js         # Middleware global pentru erori
│   └── logger.js               # Logging request-uri HTTP
│
├── socket/
│   └── socketHandler.js        # Gestionare evenimente Socket.io
│
├── routes/                     # (TODO: Etapa viitoare)
│   ├── securityRoutes.js       # Proxy către wh-security
│   └── gatewayRoutes.js        # Proxy către wh-svc-gateway
│
├── controllers/                # (TODO: Etapa viitoare)
│   ├── securityController.js
│   └── gatewayController.js
│
└── services/                   # (TODO: Etapa viitoare)
    └── proxyService.js         # Logică agregare și transformare
```

---

## Componentă Cheie: index.js

### Responsabilități
1. Inițializare Express app
2. Creare HTTP server
3. Atașare Socket.io la server
4. Configurare middleware-uri globale (CORS, JSON parser, logger)
5. Montare rute API
6. Inițializare Socket.io handlers
7. Pornire server pe portul configurat

### Cod Esențial
```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const config = require('./config/envConfig');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.CORS_ORIGIN, methods: ['GET', 'POST'] }
});

// Middleware-uri
app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json());
app.use(logger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'wh-client-backend',
    environment: config.NODE_ENV
  });
});

// Inițializare Socket.io
initializeSocketHandlers(io);

// Error handler (ultimul middleware)
app.use(errorHandler);

// Start server
server.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});
```

---

## Configurare Environment Variables

### Fișier: config/envConfig.js

**Funcționalități:**
- Încărcare automată variabile din `.env` (folosind `dotenv`)
- Export config object cu valori default
- Validare variabile obligatorii la startup
- Throw error dacă lipsesc variabile critice

### Variabile Suportate

| Variabilă | Default | Descriere |
|-----------|---------|-----------|
| PORT | 3000 | Portul pe care rulează serverul |
| NODE_ENV | development | Environment (development/production) |
| SECURITY_SVC_URL | http://localhost:8080 | URL serviciu wh-security |
| GATEWAY_SVC_URL | http://localhost:8081 | URL serviciu wh-svc-gateway |
| CORS_ORIGIN | http://localhost:5173 | Origin permis pentru CORS (Frontend Vite) |

### Exemplu .env
```env
PORT=3000
NODE_ENV=development
SECURITY_SVC_URL=http://localhost:8080
GATEWAY_SVC_URL=http://localhost:8081
CORS_ORIGIN=http://localhost:5173
```

---

## Middleware

### 1. Logger (middleware/logger.js)
**Scop:** Logging request-uri HTTP pentru debugging și monitoring

**Funcționalitate:**
- Capturează metodă HTTP, path, status code
- Calculează durata execuției request-ului
- Afișare log la finalizarea request-ului

**Format output:**
```
[2026-02-06T03:39:15.999Z] GET /health - 200 (5ms)
```

### 2. Error Handler (middleware/errorHandler.js)
**Scop:** Gestionare centralizată a erorilor

**Funcționalitate:**
- Capturează toate erorile din aplicație
- Formatare uniformă răspuns JSON
- Extrage status code și mesaj din erori Axios (servicii Java)
- Include stack trace în development mode
- Logging erori cu timestamp

**Format răspuns:**
```json
{
  "success": false,
  "message": "Eroare internă server",
  "timestamp": "2026-02-06T03:39:15.999Z"
}
```

---

## WebSocket (Socket.io)

### Fișier: socket/socketHandler.js

**Responsabilități:**
1. Gestionare evenimente client: `connection`, `disconnect`, `ping`
2. Broadcasting mesaje către toți clienții
3. Trimitere mesaje selective către rooms

### Evenimente Suportate

| Eveniment | Direcție | Descriere |
|-----------|----------|-----------|
| connection | Server ← Client | Client se conectează |
| disconnect | Server ← Client | Client se deconectează |
| ping | Server ← Client | Test conectivitate |
| pong | Server → Client | Răspuns la ping |
| join-room | Server ← Client | Client se alătură unui room |

### Funcții Helper

#### broadcastMessage(io, eventName, data)
Trimite mesaj către toți clienții conectați
```javascript
broadcastMessage(io, 'webhook-event', {
  type: 'CLIENT_REGISTERED',
  payload: { clientId: 123, status: 'SUCCESS' }
});
```

#### sendToRoom(io, roomName, eventName, data)
Trimite mesaj selectiv către un room
```javascript
sendToRoom(io, 'client-123', 'notification', {
  message: 'Webhook processed successfully'
});
```

---

## CORS Configuration

**Scop:** Permite Frontend-ul (Vite pe 5173) să facă request-uri către Backend (3000)

**Configurare Express:**
```javascript
app.use(cors({ origin: config.CORS_ORIGIN }));
```

**Configurare Socket.io:**
```javascript
const io = new Server(server, {
  cors: {
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST']
  }
});
```

---

## Rulare și Dezvoltare

### Comenzi Disponibile

```bash
# Dezvoltare (cu hot-reload)
npm run dev

# Production
npm start
```

### Hot-Reload (nodemon)
Configurare automată pentru reîncărcare la modificări în:
- `*.js` files
- `*.json` files

---

## Health Check Endpoint

### GET /health

**Scop:** Verificare status server (pentru monitoring, Docker health checks)

**Response:**
```json
{
  "status": "UP",
  "timestamp": "2026-02-06T03:39:15.999Z",
  "service": "wh-client-backend",
  "environment": "development"
}
```

**Status Codes:**
- 200 OK: Server funcțional

---

## Securitate

### Măsuri Implementate
1. **CORS:** Restricționare origin la Frontend URL
2. **Environment Variables:** Credențiale și URL-uri sensibile în `.env` (nu în Git)
3. **Error Handling:** Stack traces doar în development mode
4. **Input Validation:** JSON body parsing cu Express built-in middleware

### TODO (Etape Viitoare)
- [ ] Autentificare și autorizare (JWT tokens)
- [ ] Rate limiting pentru API endpoints
- [ ] Helmet.js pentru HTTP headers security
- [ ] Input sanitization și validare cu Joi/Yup

---

## Dependențe și Versiuni

### Production
```json
{
  "express": "^5.2.1",
  "socket.io": "^4.8.3",
  "axios": "^1.13.4",
  "cors": "^2.8.6",
  "dotenv": "^17.2.4"
}
```

### Development
```json
{
  "nodemon": "^3.1.11"
}
```

---

## Diagrame

### Flow Request HTTP
```
Frontend → HTTP POST /api/gateway/register
    ↓
Express Router
    ↓
Controller (orchestration)
    ↓
Service (Axios call to Java)
    ↓
wh-svc-gateway:8081
    ↓
Response ← JSON
    ↓
Frontend (primește răspuns)
```

### Flow WebSocket Event
```
Backend (trigger intern sau din Java)
    ↓
socketHandler.broadcastMessage()
    ↓
Socket.io emit('webhook-event')
    ↓
Frontend WebSocketContext (listener)
    ↓
UI Update (toast notification)
```

---

## Performance și Scalare

### Optimizări Actuale
- Async/Await pentru operații non-blocking
- Connection pooling implicit în Axios
- Socket.io rooms pentru trimitere selectivă

### Considerații Viitoare
- Load balancing cu multiple instanțe Node.js
- Redis adapter pentru Socket.io (multi-server)
- Caching răspunsuri frecvente (Redis/Memcached)
- Compression middleware pentru răspunsuri HTTP

---

## Troubleshooting

### Problem: Server nu pornește
**Cauză:** Port 3000 ocupat  
**Soluție:** Schimbă PORT în `.env` sau oprește procesul existent

### Problem: CORS errors în Frontend
**Cauză:** CORS_ORIGIN incorect configurat  
**Soluție:** Verifică că CORS_ORIGIN=http://localhost:5173 în `.env`

### Problem: Nu se conectează la serviciile Java
**Cauză:** wh-security sau wh-svc-gateway nu rulează  
**Soluție:** Pornește serviciile Java înainte de Backend BFF

---

## Referințe
- **Express.js:** https://expressjs.com/
- **Socket.io:** https://socket.io/docs/v4/
- **Axios:** https://axios-http.com/docs/intro
- **Node.js Best Practices:** https://github.com/goldbergyoni/nodebestpractices

---

**Versiune documentație:** 1.0  
**Data:** 06 Februarie 2026  
**Ultima actualizare:** Etapa 1 - Setup inițial
