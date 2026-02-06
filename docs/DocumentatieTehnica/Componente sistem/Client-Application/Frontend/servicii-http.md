# Servicii HTTP - Frontend

## Prezentare Generală

Layer-ul de servicii HTTP este responsabil pentru comunicarea între Frontend (React) și Backend BFF (Node.js) prin request-uri REST API. Acest layer utilizează Axios ca HTTP client și oferă o interfață curată pentru componente UI.

---

## Arhitectură

```
┌─────────────────────────────────────────────────────┐
│              UI Components (React)                   │
│         (RegisterForm, WebhookList, etc.)           │
└─────────────────────────────────────────────────────┘
                         ▲
                         │ import { registerService }
                         ▼
┌─────────────────────────────────────────────────────┐
│              Services Layer                          │
│  ┌──────────────────┐    ┌──────────────────────┐  │
│  │ registerService  │    │  webhookService      │  │
│  │ - registerClient │    │ - createSubscription │  │
│  │ - getDetails     │    │ - getEvents          │  │
│  │ - updateClient   │    │ - retryWebhook       │  │
│  └──────────────────┘    └──────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         ▲
                         │ import axiosClient
                         ▼
┌─────────────────────────────────────────────────────┐
│              Axios Client                            │
│  - BaseURL configuration                            │
│  - Request/Response interceptors                     │
│  - Error handling                                    │
│  - Authentication (TODO)                             │
└─────────────────────────────────────────────────────┘
                         ▲
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────┐
│         Backend BFF (Node.js Express)                │
│              Port: 3000                              │
└─────────────────────────────────────────────────────┘
```

---

## Axios Client Configuration

### Fișier: `src/api/axiosClient.js`

**Responsabilități:**
- Configurare centralizată pentru toate request-urile HTTP
- Gestionare interceptori pentru request/response
- Error handling uniform
- Logging pentru debugging

### Configurare de Bază

```javascript
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 10000, // 10 secunde
  headers: {
    'Content-Type': 'application/json',
  },
});
```

**Environment Variable:**
```env
VITE_API_URL=http://localhost:3000
```

### Request Interceptor

**Funcționalitate:**
- Logging request-uri pentru debugging
- Adăugare token autentificare (TODO)
- Modificare headers dinamic

```javascript
axiosClient.interceptors.request.use(
  (config) => {
    // TODO: JWT token când autentificarea este implementată
    console.log(`[HTTP REQUEST] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[HTTP REQUEST ERROR]', error);
    return Promise.reject(error);
  }
);
```

### Response Interceptor

**Funcționalitate:**
- Logging răspunsuri success
- Gestionare erori HTTP (401, 403, 404, 5xx)
- Formatare mesaje eroare pentru utilizator
- Integrare cu Notistack (în App.jsx)

```javascript
axiosClient.interceptors.response.use(
  (response) => {
    console.log(`[HTTP RESPONSE] ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    const message = error.response?.data?.message || 
                   error.message || 
                   'Eroare de comunicare cu serverul';
    
    const statusCode = error.response?.status;
    
    // Gestionare specifică pe cod de status
    if (statusCode === 401) {
      console.warn('Unauthorized - session expired');
    } else if (statusCode === 403) {
      console.warn('Forbidden - insufficient permissions');
    } else if (statusCode === 404) {
      console.warn('Not Found - endpoint does not exist');
    } else if (statusCode >= 500) {
      console.error('Server Error - backend issue');
    }

    // Proprietate customizată pentru UI
    error.userMessage = message;
    
    return Promise.reject(error);
  }
);
```

---

## Register Service

### Fișier: `src/services/registerService.js`

Serviciu pentru gestionarea înregistrării și administrării clienților în sistem.

### Metode Disponibile

#### 1. registerClient(clientData)
**Scop:** Înregistrare client nou în sistem

**Parametri:**
```javascript
/**
 * @param {Object} clientData
 * @param {string} clientData.clientName - Numele clientului
 * @param {string} clientData.email - Email-ul clientului
 * @param {string} clientData.callbackUrl - URL pentru webhook-uri
 */
```

**Request:**
```javascript
POST /api/gateway/clients/register
{
  "clientName": "TestClient",
  "email": "test@example.com",
  "callbackUrl": "https://example.com/webhook"
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Client înregistrat cu succes",
  "data": {
    "clientId": 123,
    "apiKey": "sk_live_abc123xyz..."
  },
  "timestamp": "2026-02-06T10:00:00Z"
}
```

**Exemplu utilizare:**
```javascript
import { registerService } from './services';

try {
  const response = await registerService.registerClient({
    clientName: 'MyCompany',
    email: 'admin@mycompany.com',
    callbackUrl: 'https://mycompany.com/webhooks'
  });
  
  console.log('Client ID:', response.data.clientId);
  console.log('API Key:', response.data.apiKey);
} catch (error) {
  console.error('Registration failed:', error.userMessage);
}
```

#### 2. checkNameAvailability(clientName)
**Scop:** Verificare disponibilitate nume client

**Request:**
```javascript
GET /api/gateway/clients/check-name?name=TestClient
```

**Response:**
```javascript
{
  "available": false,
  "suggestion": "TestClient2"
}
```

#### 3. getClientDetails(clientId)
**Scop:** Obținere detalii despre un client

**Request:**
```javascript
GET /api/gateway/clients/123
```

**Response:**
```javascript
{
  "success": true,
  "data": {
    "clientId": 123,
    "clientName": "TestClient",
    "email": "test@example.com",
    "callbackUrl": "https://example.com/webhook",
    "status": "ACTIVE",
    "createdAt": "2026-01-15T10:00:00Z"
  }
}
```

#### 4. updateClient(clientId, updates)
**Scop:** Actualizare date client

**Request:**
```javascript
PUT /api/gateway/clients/123
{
  "callbackUrl": "https://new-url.com/webhook",
  "email": "newemail@example.com"
}
```

#### 5. deleteClient(clientId)
**Scop:** Ștergere client din sistem

**Request:**
```javascript
DELETE /api/gateway/clients/123
```

**Response:**
```javascript
{
  "success": true,
  "message": "Client șters cu succes"
}
```

---

## Webhook Service

### Fișier: `src/services/webhookService.js`

Serviciu complet pentru gestionarea webhook-urilor, subscripțiilor și evenimentelor.

### Metode Disponibile

#### 1. createSubscription(subscriptionData)
**Scop:** Creare subscriere webhook pentru un tip de eveniment

**Parametri:**
```javascript
/**
 * @param {Object} subscriptionData
 * @param {number} subscriptionData.clientId - ID client
 * @param {string} subscriptionData.eventType - Tip eveniment
 * @param {string} subscriptionData.callbackUrl - URL webhook
 * @param {boolean} [subscriptionData.active=true] - Status activ
 */
```

**Request:**
```javascript
POST /api/gateway/webhooks/subscribe
{
  "clientId": 123,
  "eventType": "ORDER_CREATED",
  "callbackUrl": "https://example.com/webhook/order"
}
```

**Response:**
```javascript
{
  "success": true,
  "data": {
    "subscriptionId": 456,
    "eventType": "ORDER_CREATED",
    "active": true
  }
}
```

#### 2. getSubscriptions(clientId)
**Scop:** Lista toate subscripțiile unui client

**Request:**
```javascript
GET /api/gateway/webhooks/subscriptions?clientId=123
```

**Response:**
```javascript
{
  "success": true,
  "data": [
    {
      "subscriptionId": 456,
      "eventType": "ORDER_CREATED",
      "callbackUrl": "https://example.com/webhook/order",
      "active": true,
      "createdAt": "2026-01-20T10:00:00Z"
    },
    {
      "subscriptionId": 457,
      "eventType": "CLIENT_REGISTERED",
      "callbackUrl": "https://example.com/webhook/client",
      "active": false,
      "createdAt": "2026-01-21T10:00:00Z"
    }
  ]
}
```

#### 3. getWebhookEvents(params)
**Scop:** Istoric evenimente webhook (paginat)

**Parametri:**
```javascript
/**
 * @param {Object} params
 * @param {number} params.clientId - ID client
 * @param {number} [params.page=1] - Număr pagină
 * @param {number} [params.pageSize=20] - Elemente per pagină
 * @param {string} [params.status] - Filtru status (PENDING/SUCCESS/FAILED)
 * @param {string} [params.eventType] - Filtru tip eveniment
 */
```

**Request:**
```javascript
GET /api/gateway/webhooks/events?clientId=123&page=1&pageSize=20&status=SUCCESS
```

**Response:**
```javascript
{
  "success": true,
  "data": [
    {
      "id": 789,
      "eventType": "ORDER_CREATED",
      "status": "SUCCESS",
      "payload": { "orderId": 555, "amount": 150.00 },
      "timestamp": "2026-02-06T09:30:00Z",
      "retryCount": 0,
      "responseCode": 200
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 20
}
```

#### 4. retryWebhook(eventId)
**Scop:** Reîncercare webhook eșuat

**Request:**
```javascript
POST /api/gateway/webhooks/events/789/retry
```

**Response:**
```javascript
{
  "success": true,
  "message": "Webhook reîncercat cu succes",
  "newStatus": "PENDING"
}
```

#### 5. testWebhook(subscriptionId)
**Scop:** Trimitere eveniment test

**Request:**
```javascript
POST /api/gateway/webhooks/subscriptions/456/test
```

**Response:**
```javascript
{
  "success": true,
  "message": "Webhook test trimis",
  "testEventId": 790
}
```

#### 6. getWebhookStats(clientId, params)
**Scop:** Statistici webhook pentru un client

**Request:**
```javascript
GET /api/gateway/webhooks/stats?clientId=123&startDate=2026-01-01&endDate=2026-01-31
```

**Response:**
```javascript
{
  "success": true,
  "data": {
    "totalEvents": 1500,
    "successRate": 98.5,
    "failedEvents": 22,
    "averageResponseTime": 250,
    "byEventType": {
      "ORDER_CREATED": 800,
      "CLIENT_REGISTERED": 700
    }
  }
}
```

---

## Error Handling

### Gestionare Erori în Servicii

Toate metodele din servicii folosesc try-catch și logging consistent:

```javascript
async methodName(params) {
  try {
    const response = await axiosClient.method('/endpoint', data);
    return response.data;
  } catch (error) {
    console.error('[serviceName.methodName] Error:', error.userMessage);
    throw error; // Propagare pentru handling în UI
  }
}
```

### Handling în Componente UI

```javascript
import { registerService } from '../services';
import { useSnackbar } from 'notistack';

function MyComponent() {
  const { enqueueSnackbar } = useSnackbar();

  const handleRegister = async (data) => {
    try {
      const response = await registerService.registerClient(data);
      enqueueSnackbar('Client înregistrat cu succes!', { variant: 'success' });
    } catch (error) {
      // Eroarea este deja afișată automat de interceptor
      // Aici putem adăuga logică suplimentară dacă e necesar
      console.error('Failed to register:', error);
    }
  };

  return (
    // ...JSX
  );
}
```

---

## Integrare cu Notistack

### Configurare în App.jsx

```javascript
import axiosClient from './api/axiosClient';
import { useSnackbar } from 'notistack';

function AxiosInterceptorSetup() {
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    const responseInterceptor = axiosClient.interceptors.response.use(
      (response) => response,
      (error) => {
        const message = error.userMessage || 'Eroare de comunicare';
        
        enqueueSnackbar(message, { 
          variant: 'error',
          autoHideDuration: 5000
        });
        
        return Promise.reject(error);
      }
    );

    return () => {
      axiosClient.interceptors.response.eject(responseInterceptor);
    };
  }, [enqueueSnackbar]);

  return null;
}
```

**Avantaj:** Toate erorile HTTP sunt afișate automat ca notificări roșii, fără cod duplicat în fiecare componentă.

---

## Best Practices

### 1. **Consistență în JSDoc**
- Toate metodele au documentație completă
- Typedef-uri pentru tipuri complexe
- Exemple de utilizare

### 2. **Error Propagation**
- Try-catch în toate metodele async
- Throw error după logging pentru handling în UI
- Mesaje prietenoase în `error.userMessage`

### 3. **Separation of Concerns**
- axiosClient = configurare și interceptori
- Services = business logic și API calls
- Components = UI și interacțiune utilizator

### 4. **DRY (Don't Repeat Yourself)**
- axiosClient refolosit în toate serviciile
- Interceptor global pentru erori
- Export centralizat în `services/index.js`

### 5. **Type Safety (via JSDoc)**
- Typedef pentru request/response objects
- IDE autocompletare și validare
- Documentație inline

---

## Troubleshooting

### Problem: CORS errors
**Cauză:** Backend BFF nu este configurat corect  
**Soluție:** Verifică `backend/.env`: `CORS_ORIGIN=http://localhost:5173`

### Problem: Timeout errors
**Cauză:** Backend nu răspunde în 10 secunde  
**Soluție:** Crește timeout în axiosClient sau verifică backend

### Problem: 401 Unauthorized
**Cauză:** Token autentificare lipsă sau expirat  
**Soluție:** Implementează autentificare JWT (TODO)

### Problem: Network Error
**Cauză:** Backend nu rulează  
**Soluție:** Pornește backend: `cd backend && npm run dev`

---

## TODO și Extensii Viitoare

- [ ] Implementare autentificare JWT
- [ ] Refresh token logic
- [ ] Request caching pentru GET calls
- [ ] Retry logic pentru failed requests
- [ ] Request cancellation (abort controller)
- [ ] Upload fișiere (multipart/form-data)
- [ ] Download fișiere (blob handling)
- [ ] WebSocket fallback pentru real-time updates

---

**Versiune documentație:** 1.0  
**Data:** 06 Februarie 2026  
**Ultima actualizare:** Etapa 2 - Layer HTTP implementat
