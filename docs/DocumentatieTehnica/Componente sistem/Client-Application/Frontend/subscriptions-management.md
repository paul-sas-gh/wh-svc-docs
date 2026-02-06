# Subscriptions Management - Implementare

## Prezentare Generală

Funcționalitate pentru afișarea subscripțiilor webhook înregistrate de client în sistem, cu stocare locală în browser pentru persistență.

---

## Flow Complet

```
1. Frontend Load (SubscriptionsPage mount)
   ↓
2. Check localStorage pentru subscripții cached
   ↓ (dacă există)
3. Display cached subscriptions instant
   ↓
4. API Call: GET /api/gateway/subscriptions/client/{clientId}
   ↓
5. Backend BFF (Node.js)
   - gatewayController.getClientSubscriptions()
   - Proxy către wh-svc-gateway:8081
   ↓
6. Java Service: GET /api/v1/subscriptions/client/{clientId}
   ↓
7. Response: Array<Subscription> sau { subscriptions: [...], total: X }
   ↓
8. Frontend:
   - Update state cu subscripții
   - Save în localStorage
   - Display în tabel
```

---

## Backend Implementation

### 1. Route: `routes/gatewayRoutes.js`

```javascript
/**
 * @route GET /api/gateway/subscriptions/client/:clientId
 * @desc Obține subscripțiile pentru un client specific
 */
router.get('/subscriptions/client/:clientId', gatewayController.getClientSubscriptions);
```

### 2. Controller: `controllers/gatewayController.js`

```javascript
getClientSubscriptions: async (req, res, next) => {
  try {
    const { clientId } = req.params;

    const requestUrl = `${config.GATEWAY_SVC_URL}/api/v1/subscriptions/client/${clientId}`;

    console.log('[GATEWAY] Client Subscriptions Request:');
    console.log('  URL:', requestUrl);
    console.log('  Client ID:', clientId);

    const response = await axios.get(requestUrl);

    console.log('[GATEWAY] Client Subscriptions Response:');
    console.log('  Status:', response.status);
    console.log('  Total Subscriptions:', response.data?.total || response.data?.length || 0);
    console.log('  Subscriptions:', JSON.stringify(response.data || [], null, 2));

    res.json(response.data);
  } catch (error) {
    console.error('[GATEWAY] Client Subscriptions Error:');
    console.error('  Status:', error.response?.status || 'N/A');
    console.error('  Message:', error.message);
    console.error('  Data:', JSON.stringify(error.response?.data || {}, null, 2));
    next(error);
  }
}
```

**Endpoint BFF:** `GET /api/gateway/subscriptions/client/{clientId}`

**Proxy către:** `http://localhost:8081/api/v1/subscriptions/client/{clientId}`

**Console Logging:**

Request log:
```
[GATEWAY] Client Subscriptions Request:
  URL: http://localhost:8081/api/v1/subscriptions/client/da6abcfe-bb06-4adc-902b-e4930fef1bf4
  Client ID: da6abcfe-bb06-4adc-902b-e4930fef1bf4
```

Response log (success):
```
[GATEWAY] Client Subscriptions Response:
  Status: 200
  Total Subscriptions: 3
  Subscriptions: [
    {
      "subscriptionId": "sub-123",
      "clientId": "da6abcfe-bb06-4adc-902b-e4930fef1bf4",
      "eventType": "order.created",
      "callbackUrl": "https://example.com/webhook",
      "active": true,
      "createdAt": "2026-02-05T21:17:41.844411"
    }
  ]
```

Error log:
```
[GATEWAY] Client Subscriptions Error:
  Status: 404
  Message: Request failed with status code 404
  Data: {
    "error": "Not Found"
  }
```

---

## Frontend Implementation

### 1. Service: `services/subscriptionService.js`

**Metode disponibile:**

#### getClientSubscriptions(clientId)
```javascript
const response = await subscriptionService.getClientSubscriptions(clientInfo.uid);
// Returns: Array<Subscription> sau { subscriptions: [...], total: 3 }
```

**Parametri:**
- `clientId` (string, required) - UID-ul clientului

**Response format:**
- Poate fi direct un array: `[{subscriptionId, clientId, eventType, ...}]`
- Sau un object: `{ subscriptions: [...], total: 3 }`

#### saveToLocalStorage(subscriptions)
```javascript
subscriptionService.saveToLocalStorage(response.subscriptions);
// Salvează în localStorage: key="clientSubscriptions"
```

#### loadFromLocalStorage()
```javascript
const cached = subscriptionService.loadFromLocalStorage();
// Returns: Array<Subscription> sau []
```

#### clearLocalStorage()
```javascript
subscriptionService.clearLocalStorage();
// Șterge din localStorage
```

#### hasLocalStorage()
```javascript
const exists = subscriptionService.hasLocalStorage();
// Returns: boolean
```

### 2. Page: `pages/SubscriptionsPage.jsx`

**Features implementate:**

✅ **Încărcare automată la mount**
- Citește din localStorage (instant display)
- Fetch de la server (update cu date fresh)

✅ **Tabel cu subscripții**
- Tip eveniment (Chip primary)
- Callback URL (monospace)
- Status (Chip verde ACTIV / gri INACTIV)
- Client (Chip verde pentru client curent)
- Data creare (formatat RO)
- ID subscriere (monospace)

✅ **Loading states**
- CircularProgress când încarcă
- Empty state când nu există subscripții
- Disabled refresh button când loading

✅ **Refresh manual**
- IconButton pentru reîncărcare
- Re-fetch de la server
- Update localStorage

✅ **Notificări**
- Success: "X subscripții încărcate"
- Info: "Nu există subscripții înregistrate"
- Error: "Eroare la încărcarea subscripțiilor"

---

## Data Structure

### Subscription Object

```typescript
{
  subscriptionId: string;   // "sub-123"
  clientId: string;         // "da6abcfe-bb06-4adc-902b-e4930fef1bf4"
  eventType: string;        // "order.created"
  callbackUrl: string;      // "https://example.com/webhook"
  active: boolean;          // true/false
  createdAt: string;        // "2026-02-05T21:17:41.844411"
  updatedAt?: string;       // "2026-02-06T10:00:00.000000"
}
```

### API Response

```json
{
  "subscriptions": [
    {
      "subscriptionId": "sub-123",
      "clientId": "da6abcfe-bb06-4adc-902b-e4930fef1bf4",
      "eventType": "order.created",
      "callbackUrl": "https://example.com/webhook",
      "active": true,
      "createdAt": "2026-02-05T21:17:41.844411"
    }
  ],
  "total": 1
}
```

Sau direct array:
```json
[
  {
    "subscriptionId": "sub-123",
    "clientId": "da6abcfe-bb06-4adc-902b-e4930fef1bf4",
    "eventType": "order.created",
    "callbackUrl": "https://example.com/webhook",
    "active": true,
    "createdAt": "2026-02-05T21:17:41.844411"
  }
]
```

---

## LocalStorage Management

### Storage Key
```
"clientSubscriptions"
```

### Storage Format
```json
[
  {
    "subscriptionId": "...",
    "clientId": "...",
    "eventType": "order.created",
    "callbackUrl": "...",
    "active": true,
    "createdAt": "..."
  }
]
```

---

## UI Components

### Table Structure

| Tip Eveniment | Callback URL | Status | Client | Data Creare | ID Subscriere |
|---------------|--------------|--------|--------|-------------|---------------|
| `order.created` | https://example.com/webhook | ACTIV | US | 05.02.2026 21:17:41 | sub-123 |

### Visual Elements

**Chip pentru eventType:**
- Color: primary
- Variant: outlined
- Size: small

**Callback URL:**
- Font: monospace
- Font size: 0.8rem
- Variant: body2

**Chip pentru status:**
- Color: success (dacă active = true)
- Color: default (dacă active = false)
- Label: ACTIV / INACTIV

**Chip pentru client:**
- Color: success (dacă este client curent)
- Color: default (altfel)
- Size: small

**Timestamp format:**
- Locale: ro-RO
- Format: DD.MM.YYYY HH:mm:ss

**ID Subscriere:**
- Font: monospace
- Variant: caption

---

## Testing

### Test 1: Load Subscripții
1. Navigate la `/subscriptions`
2. Check loading state (CircularProgress)
3. Verify API call: `GET /api/gateway/subscriptions/client/{clientId}`
4. Verify tabel populat cu subscripții
5. Check localStorage: `clientSubscriptions` există

### Test 2: Refresh
1. Click buton Refresh
2. Verify loading state
3. Verify API re-call
4. Verify tabel update

### Test 3: Empty State
1. Configurează backend să returneze array gol
2. Navigate la `/subscriptions`
3. Verify empty state UI:
   - Icon WebhookIcon
   - Mesaj "Nu există subscripții înregistrate"
   - Buton "Reîncarcă"

### Test 4: LocalStorage Persistence
1. Load subscripții
2. Refresh browser (F5)
3. Verify subscripții apar instant (din localStorage)
4. Verify apoi API call pentru update

### Test 5: Status Display
1. Verify Chip verde pentru subscripții active
2. Verify Chip gri pentru subscripții inactive

---

## Error Handling

### Scenarii

**1. API Error 404**
```javascript
catch (error) {
  console.error('Failed to load subscriptions:', error);
  enqueueSnackbar('Eroare la încărcarea subscripțiilor', {
    variant: 'error'
  });
}
```

**Cauză:** Endpoint-ul nu există în gateway sau svc-manager

**2. LocalStorage Error**
```javascript
try {
  localStorage.setItem('clientSubscriptions', JSON.stringify(subscriptions));
} catch (error) {
  console.error('[subscriptionService.saveToLocalStorage] Error:', error);
}
```

---

## Debugging

### Console Logs Backend

```
[GATEWAY] Client Subscriptions Request:
  URL: http://localhost:8081/api/v1/subscriptions/client/da6abcfe-bb06-4adc-902b-e4930fef1bf4
  Client ID: da6abcfe-bb06-4adc-902b-e4930fef1bf4

[GATEWAY] Client Subscriptions Response:
  Status: 200
  Total Subscriptions: 3
  Subscriptions: [ ... ]
```

### Console Logs Frontend

```
[SubscriptionsPage] Loaded from localStorage: 3
[subscriptionService] Subscripții salvate în localStorage: 3
```

---

## Comparație cu EventsPage

| Aspect | EventsPage | SubscriptionsPage |
|--------|------------|-------------------|
| **Endpoint** | `/event-types/client/:clientId` | `/subscriptions/client/:clientId` |
| **LocalStorage Key** | `registeredEventTypes` | `clientSubscriptions` |
| **Entitate** | EventType | Subscription |
| **Coloane** | eventType, descriere, client, data, ID | eventType, callbackUrl, status, client, data, ID |
| **Status Chip** | - | ✅ ACTIV/INACTIV |
| **Callback URL** | - | ✅ Afișat monospace |

---

**Versiune:** 1.0  
**Data:** 06 Februarie 2026  
**Status:** ✅ Implementat complet
