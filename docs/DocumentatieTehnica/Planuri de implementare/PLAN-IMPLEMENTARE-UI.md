# Plan Implementare UI - WebHooks Client

## Obiectiv
Implementarea unei interfețe grafice (Frontend) care comunică cu backend-ul folosind o arhitectură hibridă:
1.  **HTTP (REST API):** Pentru acțiuni tranzacționale (ex: Înregistrare client, Modificare setări).
2.  **WebSockets:** Pentru recepționarea mesajelor și notificărilor în timp real de la backend ("Server to Client communication").

---

## 1. Stack Tehnologic Propus
Deoarece `wh-client` este momentan doar un placeholder, se propune inițializarea unui SPA (Single Page Application):

*   **Core:** React + JavaScript (versiune ES6+).
*   **Build Tool:** Vite (pentru viteză de dezvoltare).
*   **HTTP Client:** Axios (pentru interceptori și configurare ușoară).
*   **WebSocket Client:** `socket.io-client` (Standardul de facto pentru Node.js).
*   **State Management:** React Context sau Zustand.

---

## 2. Arhitectura de Comunicare

### 2.1. Canalul HTTP (Outbound)
Frontend-ul inițiază cereri către Backend (Node.js/Express).
*   **Utilizare:** Login, Înregistrare Client, Configurare Webhook-uri, Fetch istoric (paginat).
*   **Flux:** `UI Component` -> `Service Layer (Axios)` -> `REST API`.

### 2.2. Canalul WebSocket (Inbound)
Backend-ul (Node.js) trimite date către Frontend.
*   **Utilizare:** Notificări live despre statusul webhook-urilor, mesaje de sistem, update-uri de procesare.
*   **Flux:** `Backend` -> `Socket.io Server` -> `Socket Event` -> `UI Listener`.

### 2.3. Integrări Backend (Server-Side)
Serverul Node.js va acționa ca un agregator/BFF (Backend for Frontend) interacționând cu microserviciile existente:
*   **Securitate:** Apeluri către `wh-security` (aplicație Java pe port **8080**) pentru servicii de criptare și decriptare.
*   **Gateway:** Apeluri către `wh-svc-gateway` (aplicație Java pe port **8081**) pentru a comunica cu `wh-svc-manager` și fluxurile de business.

---

## 3. Plan de Implementare (Step-by-Step)

### Etapa 1: Setup Proiect și Structură
Proiectul `wh-client` va fi împărțit în două submodule distincte pentru a separa clar responsabilitățile:

*   `wh-client/frontend`: Aplicația React (UI).
*   `wh-client/backend`: Serverul Node.js (BFF).

#### 1. Inițializare Frontend
```bash
# În directorul wh-client
npm create vite@latest frontend -- --template react
cd frontend
npm install axios socket.io-client react-router-dom @mui/material @emotion/react @emotion/styled @mui/icons-material
```

#### 2. Inițializare Backend
```bash
# În directorul wh-client
mkdir backend
cd backend
npm init -y
npm install express socket.io cors axios dotenv nodemon
```

### Etapa 1.5: Configurare Environment Variables
Pentru flexibilitate și separarea configurației de cod, toate porturile și URL-urile serviciilor vor fi externalizate în fișiere `.env`.

#### A. Frontend (.env)
Locație: `wh-client/frontend/.env`
```env
VITE_API_URL=http://localhost:3000
```

#### B. Backend (.env)
Locație: `wh-client/backend/.env`
```env
PORT=3000
SECURITY_SVC_URL=http://localhost:8080
GATEWAY_SVC_URL=http://localhost:8081
NODE_ENV=development
```

**Nota:** Fișierele `.env` trebuie adăugate în `.gitignore`. Se va crea și un `.env.example` pentru fiecare modul ca template.

### Etapa 1.6: Structura Globală Root și Developer Experience
Pentru a facilita dezvoltarea și rularea ambelor servere (Frontend + Backend) dintr-o singură comandă, vom crea un `package.json` în rădăcina `wh-client`.

#### A. Creare package.json Root
Locație: `wh-client/package.json`
```bash
cd wh-client
npm init -y
npm install --save-dev concurrently
```

**Conținut package.json:**
```json
{
  "name": "wh-client",
  "version": "1.0.0",
  "description": "WebHooks Client Application",
  "scripts": {
    "install:all": "cd frontend && npm install && cd ../backend && npm install",
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "cd backend && npm run dev",
    "dev:frontend": "cd frontend && npm run dev",
    "build:frontend": "cd frontend && npm run build"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

#### B. Configurare package.json pentru Frontend
Locație: `wh-client/frontend/package.json`
Adăugați scriptul:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

#### C. Configurare package.json pentru Backend
Locație: `wh-client/backend/package.json`
Adăugați scriptul:
```json
"scripts": {
  "dev": "nodemon index.js",
  "start": "node index.js"
}
```

#### D. Utilizare
Din directorul `wh-client`:
*   **Instalare toate dependențele:** `npm run install:all`
*   **Rulare concurentă (Dezvoltare):** `npm run dev` - pornește atât Frontend-ul (Vite pe 5173) cât și Backend-ul (Node pe 3000).
*   **Build Frontend:** `npm run build:frontend`

**Avantaje:**
*   Un singur terminal pentru dezvoltare.
*   Sincronizare: Când schimbi ceva în Backend sau Frontend, ambele se reîncarcă automat.
*   Simplifică onboarding-ul noilor dezvoltatori.

### Etapa 2: Implementare Layer HTTP (Frontend)
Locație: `wh-client/frontend/src`

1.  Creare `api/axiosClient.js`:
    *   Configurare BaseURL (din `import.meta.env.VITE_API_URL`).
    *   Adăugare interceptors pentru Auth.
    *   Adăugare interceptor pentru erori cu delegare către `notistack`.
2.  Implementare servicii (`services/`):
    *   `registerService.js`: POST /register
    *   `webhookService.js`: POST /webhook, GET /webhooks

### Etapa 3: Implementare Layer WebSocket & Backend Logic
#### A. Configurare Server (Backend)
Locație: `wh-client/backend`

**Structură directoare propusă:**
```
backend/
├── index.js          # Entry point, setup Express + Socket.io
├── config/
│   └── envConfig.js  # Centralizare variabile ENV
├── routes/
│   ├── securityRoutes.js   # Proxy către wh-security
│   └── gatewayRoutes.js    # Proxy către wh-svc-gateway
├── controllers/
│   ├── securityController.js
│   └── gatewayController.js
├── middleware/
│   ├── errorHandler.js     # Middleware global pentru erori
│   └── logger.js           # Logging middleware
├── services/
│   └── proxyService.js     # Logică agregare/transformare
└── socket/
    └── socketHandler.js    # Gestionare evenimente Socket.io
```

**Arhitectura BFF (Backend For Frontend):**
1.  **Proxy Manual cu Axios (Recomandat pentru început):**
    *   Fiecare rută (ex: `/api/security/encrypt`) va apela manual `axios.post(SECURITY_SVC_URL + '/encrypt')`.
    *   Avantaj: Control total asupra request/response, posibilitate de agregare și transformare.
    *   Dezavantaj: Mai mult cod boilerplate.

2.  **Alternativă (Pentru rutare simplă):**
    *   Folosirea `http-proxy-middleware` pentru rutele care nu necesită logică custom.
    *   Exemplu: 
    ```javascript
    app.use('/api/gateway', createProxyMiddleware({ 
      target: process.env.GATEWAY_SVC_URL, 
      changeOrigin: true 
    }));
    ```

**Implementare:**
1.  `index.js`: Setup Express + Socket.io + Încărcare ENV.
2.  `config/envConfig.js`: Exportă variabile din `.env` cu validare.
3.  `routes/`: Rutele API care fac proxy către serviciile Java.
4.  `controllers/`: Logica de orchestrare și transformare date.
5.  `middleware/errorHandler.js`: Capturează erorile din serviciile Java și le formatează uniform pentru Frontend.
6.  `socket/socketHandler.js`: Gestionare evenimente și broadcasting către clienți.

#### B. Configurare Client (Frontend)
Locație: `wh-client/frontend/src`
1.  Creare `context/WebSocketContext.jsx`:
    *   Gestionarea conexiunii (Connect/Disconnect) cu `socket.io-client`.
    *   Gestionarea reconectării automate.
2.  Ascultare evenimente:
    *   `socket.on('webhook-event', callback)`: Evenimente specifice webhook-urilor.
    *   `socket.on('system-message', callback)`: Mesaje sistem.

### Etapa 4: Dezvoltare UI și Notificări
1.  **Provider Setup:** Integrare `SnackbarProvider` (din `notistack`) în `App.jsx` pentru notificări globale (Toast).
2.  **ConnectionIndicator Component:** Afișează starea conexiunii socket (online/offline/reconnecting).
3.  **MessageLog Component:** O listă care afișează mesajele primite prin socket în timp real.
4.  **ActionPanel Component:** Formular pentru a trimite comenzi prin HTTP.
5.  **Error Handling și Notificări:**
    *   **Axios Interceptor (Frontend):**
        ```javascript
        axiosClient.interceptors.response.use(
          response => response,
          error => {
            const message = error.response?.data?.message || 'Eroare de comunicare';
            enqueueSnackbar(message, { variant: 'error' });
            return Promise.reject(error);
          }
        );
        ```
    *   **Backend Error Handler:**
        Când serviciul Java returnează eroare (ex: 500 din `wh-svc-gateway`), backend-ul Node.js va formata răspunsul:
        ```javascript
        // middleware/errorHandler.js
        function errorHandler(err, req, res, next) {
          const statusCode = err.response?.status || 500;
          const message = err.response?.data?.message || 'Eroare internă server';
          res.status(statusCode).json({
            success: false,
            message: message,
            timestamp: new Date().toISOString()
          });
        }
        ```
    *   **Notificări Socket:** Mesajele de eroare primite prin Socket vor fi afișate automat ca Snackbar roșu.

### Etapa 4.5: Instalare și Configurare Notistack
Notistack este deja inclus în lista de dependențe MUI din Etapa 1, dar pentru claritate:
```bash
cd frontend
npm install notistack
```

**Setup în App.jsx:**
```javascript
import { SnackbarProvider } from 'notistack';

function App() {
  return (
    <SnackbarProvider 
      maxSnack={3} 
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      autoHideDuration={3000}
    >
      {/* Rest of app */}
    </SnackbarProvider>
  );
}
```

### Etapa 5: Integrare și Testare
1.  Verificare CORS pe backend (Node.js).
2.  Testare flow complet:
    *   User trimite HTTP Request (Trigger).
    *   Server procesează.
    *   User primește WebSocket Event cu rezultatul.

---

## 4. Contracte de Date și JSDoc

Deoarece folosim JavaScript, vom utiliza **JSDoc** pentru a documenta structurile și a beneficia de IntelliSense.

### 4.1. Mesaje Socket (WebSocket)
**Definiție JSDoc:**
```javascript
/**
 * @typedef {Object} SocketMessage
 * @property {string} type - Tipul evenimentului (ex: 'WEBHOOK_EVENT', 'SYSTEM_MESSAGE')
 * @property {string} timestamp - Data ISO a evenimentului
 * @property {Object} payload - Datele efective
 * @property {string} payload.status - Status procesare (SUCCESS/FAIL/PENDING)
 * @property {string} [payload.details] - Detalii suplimentare (opțional)
 */

/**
 * Listener pentru evenimente webhook
 * @param {SocketMessage} message - Mesajul primit prin socket
 */
function handleWebhookEvent(message) {
  console.log(message.type, message.payload.status);
}
```

**Exemplu Mesaj Socket (JSON):**
```json
{
  "type": "WEBHOOK_EVENT",
  "timestamp": "2026-02-06T12:00:00Z",
  "payload": {
    "status": "SUCCESS",
    "details": "Client registered successfully"
  }
}
```

### 4.2. Request-uri HTTP
**Definiție JSDoc pentru API Calls:**
```javascript
/**
 * @typedef {Object} RegisterClientRequest
 * @property {string} clientName - Numele clientului
 * @property {string} email - Email-ul clientului
 * @property {string} callbackUrl - URL-ul pentru webhook-uri
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Indicator succes/eșec
 * @property {string} [message] - Mesaj descriptiv (opțional)
 * @property {Object} [data] - Date returnate (opțional)
 * @property {string} [timestamp] - Timestamp răspuns
 */

/**
 * Înregistrează un client nou
 * @param {RegisterClientRequest} request - Datele clientului
 * @returns {Promise<ApiResponse>} Răspunsul API-ului
 */
async function registerClient(request) {
  const response = await axios.post('/api/gateway/clients/register', request);
  return response.data;
}
```

**Exemplu Request HTTP (JSON):**
```json
{
  "clientName": "TestClient",
  "email": "test@example.com",
  "callbackUrl": "https://example.com/webhook"
}
```

### 4.3. Avantajele JSDoc
*   **IntelliSense:** IDE-ul (IntelliJ/VSCode) oferă autocompletare și verificare tipuri.
*   **Documentație inline:** Nu necesită TypeScript, dar oferă beneficii similare.
*   **Validare IDE:** Erori sunt semnalate în timpul scrierii codului.
*   **Mentenanță:** Ușor de actualizat când se schimbă contractele API.

---

## 5. Librării UI

Conform deciziei, se va utiliza **Material UI (MUI)**.

### Configurare MUI + Notistack
*   **Stil:** Google Material Design.
*   **Pachete necesare:**
    *   `@mui/material` - Componente UI
    *   `@emotion/react` - Styling engine
    *   `@emotion/styled` - Styled components
    *   `@mui/icons-material` - Iconițe Material
    *   `notistack` - Sistem de notificări (Toast)
*   **Instalare:**
    ```bash
    npm install @mui/material @emotion/react @emotion/styled @mui/icons-material notistack
    ```

**Avantaje Notistack:**
*   Integrare nativă cu MUI.
*   Suport pentru multiple notificări simultane (stacking).
*   Customizare pe tip (success, error, warning, info).
*   API imperativ (`enqueueSnackbar`) ușor de integrat în servicii.

---

## 6. Documentație și Raportare

### 6.1. Documentație Tehnică
Toate componentele Client Application vor fi documentate în directorul de documentație tehnică al proiectului.

**Locație:** `wh-svc-docs/docs/DocumentatieTehnica/Componente sistem/Client-Application/`

**Structură propusă:**
```
Client-Application/
├── Frontend/
│   ├── arhitectura-frontend.md          # Arhitectură generală React + Vite
│   ├── componente-ui.md                 # Documentație componente MUI
│   ├── servicii-http.md                 # Layer Axios și servicii API
│   ├── websocket-integration.md         # Integrare Socket.io Client
│   └── state-management.md              # Context API / Zustand
└── Backend/
    ├── arhitectura-bff.md               # Arhitectură Backend For Frontend
    ├── proxy-services.md                # Integrare cu wh-security și wh-gateway
    ├── socket-server.md                 # Configurare Socket.io Server
    ├── middleware.md                    # Error handling și logging
    └── environment-config.md            # Gestionare variabile ENV
```

**Conținut documentație:**
*   Diagrame arhitecturale (flow HTTP, flow WebSocket)
*   Exemple de cod JSDoc
*   Configurații și best practices
*   Troubleshooting comun

### 6.2. Rapoarte de Implementare
Pe parcursul dezvoltării, fiecare etapă din plan va fi documentată cu statusul implementării, probleme întâlnite și soluții aplicate.

**Locație:** `wh-svc-docs/docs/DocumentatieTehnica/Rapoarte de implementare/Client-Application/`

**Structură rapoarte:**
```
Client-Application/
├── raport-etapa-1-setup.md              # Setup proiect, instalare dependențe
├── raport-etapa-2-http-layer.md         # Implementare Axios și servicii
├── raport-etapa-3-websocket-bff.md      # Backend BFF și Socket.io
├── raport-etapa-4-ui-components.md      # Componente UI și notificări
├── raport-etapa-5-testing.md            # Integrare și testare end-to-end
└── issues-log.md                        # Log probleme și rezolvări
```

**Format raport (template):**
```markdown
# Raport Implementare - [Nume Etapă]

## Data
[Data începere] - [Data finalizare]

## Obiective Etapă
- [ ] Obiectiv 1
- [ ] Obiectiv 2

## Pași Efectuați
1. **[Acțiune]**: Descriere detaliată
   - Comandă rulată: `npm install ...`
   - Rezultat: Success/Issues

## Status Implementare
- ✅ Completat
- 🔄 În progres
- ❌ Blocat

## Probleme Întâlnite
| Problema | Severitate | Soluție | Status |
|----------|-----------|---------|--------|
| CORS Error | High | Configurare middleware | ✅ Rezolvat |

## Următorii Pași
- Task 1
- Task 2

```

### 6.3. Actualizare Continuă
*   **Frontend:** După finalizarea fiecărei componente majore, se actualizează documentația tehnică corespunzătoare.
*   **Backend:** După implementarea fiecărui modul (proxy, socket, middleware), se documentează interfața și contractele.
*   **Rapoarte:** La finalul fiecărei etape de lucru (zilnic/săptămânal), se completează raportul de implementare.

**Responsabilitate:** Dezvoltatorul care implementează funcționalitatea este responsabil de actualizarea documentației și raportului corespunzător.

