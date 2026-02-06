# Event Types Management - Implementare

## Prezentare Generală

Funcționalitate pentru afișarea evenimentelor înregistrate de client în sistem, cu stocare locală în browser pentru persistență.

---

## Flow Complete

```
1. Frontend Load (EventsPage mount)
   ↓
2. Check localStorage pentru evenimente cached
   ↓ (dacă există)
3. Display cached events instant
   ↓
4. API Call: GET /api/gateway/event-types/client/{clientId}
   ↓
5. Backend BFF (Node.js)
   - gatewayController.getClientEventTypes()
   - Proxy către wh-svc-gateway:8081
   ↓
6. Java Service: GET /api/v1/event-types/client/{clientId}
   ↓
7. Response: Array<EventType> sau { eventTypes: [...], total: 2 }
   ↓
8. Frontend:
   - Update state cu evenimente
   - Save în localStorage
   - Display în tabel
```

---

## Backend Implementation

### 1. Route: `routes/gatewayRoutes.js`

```javascript
/**
 * @route GET /api/gateway/event-types/client/:clientId
 * @desc Obține tipurile de evenimente înregistrate de un client
 */
router.get('/event-types/client/:clientId', gatewayController.getClientEventTypes);
```

### 2. Controller: `controllers/gatewayController.js`

```javascript
getClientEventTypes: async (req, res, next) => {
  try {
    const { clientId } = req.params;

    const requestUrl = `${config.GATEWAY_SVC_URL}/api/v1/event-types/client/${clientId}`;

    console.log('[GATEWAY] Client Event Types Request:');
    console.log('  URL:', requestUrl);
    console.log('  Client ID:', clientId);

    const response = await axios.get(requestUrl);

    console.log('[GATEWAY] Client Event Types Response:');
    console.log('  Status:', response.status);
    console.log('  Total Events:', response.data?.total || response.data?.length || 0);
    console.log('  Event Types:', JSON.stringify(response.data || [], null, 2));

    res.json(response.data);
  } catch (error) {
    console.error('[GATEWAY] Client Event Types Error:');
    console.error('  Status:', error.response?.status || 'N/A');
    console.error('  Message:', error.message);
    console.error('  Data:', JSON.stringify(error.response?.data || {}, null, 2));
    next(error);
  }
}
```

**Endpoint BFF:** `GET /api/gateway/event-types/client/{clientId}`

**Proxy către:** `http://localhost:8081/api/v1/event-types/client/{clientId}`

**Console Logging:**

Request log:
```
[GATEWAY] Client Event Types Request:
  URL: http://localhost:8081/api/v1/event-types/client/da6abcfe-bb06-4adc-902b-e4930fef1bf4
  Client ID: da6abcfe-bb06-4adc-902b-e4930fef1bf4
```

Response log (success):
```
[GATEWAY] Client Event Types Response:
  Status: 200
  Total Events: 2
  Event Types: [
    {
      "eventId": "d8f8dd7a-f1ed-425f-8d40-149e597167da",
      "clientId": "da6abcfe-bb06-4adc-902b-e4930fef1bf4",
      "eventType": "order.created",
      ...
    }
  ]
```

Error log:
```
[GATEWAY] Client Event Types Error:
  Status: 500
  Message: Request failed with status code 500
  Data: {
    "error": "Internal server error"
  }
```

---

## Frontend Implementation

### 1. Service: `services/eventTypeService.js`

**Metode disponibile:**

#### getClientEventTypes(clientId)
```javascript
const response = await eventTypeService.getClientEventTypes(clientInfo.uid);
// Returns: Array<EventType> sau { eventTypes: [...], total: 2 }
```

**Parametri:**
- `clientId` (string, required) - UID-ul clientului

**Response format:**
- Poate fi direct un array: `[{eventId, clientId, eventType, ...}]`
- Sau un object: `{ eventTypes: [...], total: 2 }`

#### saveToLocalStorage(eventTypes)
```javascript
eventTypeService.saveToLocalStorage(response.eventTypes);
// Salvează în localStorage: key="registeredEventTypes"
```

#### loadFromLocalStorage()
```javascript
const cached = eventTypeService.loadFromLocalStorage();
// Returns: Array<EventType> sau []
```

#### clearLocalStorage()
```javascript
eventTypeService.clearLocalStorage();
// Șterge din localStorage
```

#### hasLocalStorage()
```javascript
const exists = eventTypeService.hasLocalStorage();
// Returns: boolean
```

### 2. Page: `pages/EventsPage.jsx`

**Features implementate:**

✅ **Încărcare automată la mount**
- Citește din localStorage (instant display)
- Fetch de la server (update cu date fresh)

✅ **Tabel cu evenimente**
- Tip eveniment (Chip primary)
- Descriere
- Client (Chip verde pentru client curent)
- Data creare (formatat RO)
- ID eveniment (monospace)

✅ **Loading states**
- CircularProgress când încarcă
- Empty state când nu există evenimente
- Disabled refresh button când loading

✅ **Refresh manual**
- IconButton pentru reîncărcare
- Re-fetch de la server
- Update localStorage

✅ **Notificări**
- Success: "X tipuri de evenimente încărcate"
- Info: "Nu există evenimente înregistrate"
- Error: "Eroare la încărcarea evenimentelor"

---

## Data Structure

### EventType Object

```typescript
{
  eventId: string;          // "d8f8dd7a-f1ed-425f-8d40-149e597167da"
  clientId: string;         // "da6abcfe-bb06-4adc-902b-e4930fef1bf4"
  eventType: string;        // "order.created"
  eventDescription: string; // "Event triggered when..."
  createdAt: string;        // "2026-02-05T21:17:41.844411"
}
```

### API Response

```json
{
  "eventTypes": [
    {
      "eventId": "d8f8dd7a-f1ed-425f-8d40-149e597167da",
      "clientId": "da6abcfe-bb06-4adc-902b-e4930fef1bf4",
      "eventType": "order.created",
      "eventDescription": "Event triggered when a new order is created",
      "createdAt": "2026-02-05T21:17:41.844411"
    },
    {
      "eventId": "5409ee84-d60b-48d6-a949-c3debbd4ed77",
      "clientId": "da6abcfe-bb06-4adc-902b-e4930fef1bf4",
      "eventType": "order.deleted",
      "eventDescription": "Event triggered when a order is deleted",
      "createdAt": "2026-02-05T21:33:16.180819"
    }
  ],
  "total": 2
}
```

---

## LocalStorage Management

### Storage Key
```
"registeredEventTypes"
```

### Storage Format
```json
[
  {
    "eventId": "...",
    "clientId": "...",
    "eventType": "order.created",
    "eventDescription": "...",
    "createdAt": "..."
  }
]
```

### Benefits
- ✅ Instant display la mount (nu așteaptă API)
- ✅ Persistență între refresh-uri
- ✅ Offline capability (dacă server down)
- ✅ Reducere API calls

---

## UI Components

### Table Structure

| Tip Eveniment | Descriere | Client | Data Creare | ID Eveniment |
|---------------|-----------|--------|-------------|--------------|
| `order.created` | Event triggered when... | US | 05.02.2026 21:17:41 | d8f8dd7a... |
| `order.deleted` | Event triggered when... | US | 05.02.2026 21:33:16 | 5409ee84... |

### Visual Elements

**Chip pentru eventType:**
- Color: primary
- Variant: outlined
- Size: small

**Chip pentru client:**
- Color: success (dacă este client curent)
- Color: default (altfel)
- Size: small

**Timestamp format:**
- Locale: ro-RO
- Format: DD.MM.YYYY HH:mm:ss

**ID Eveniment:**
- Font: monospace
- Variant: caption

---

## Testing

### Test 1: Load Evenimente
1. Navigate la `/events`
2. Check loading state (CircularProgress)
3. Verify API call: `GET /api/gateway/event-types/client/{clientId}`
4. Verify tabel populat cu evenimente
5. Check localStorage: `registeredEventTypes` există

### Test 2: Refresh
1. Click buton Refresh
2. Verify loading state
3. Verify API re-call
4. Verify tabel update

### Test 3: Empty State
1. Configurează backend să returneze array gol
2. Navigate la `/events`
3. Verify empty state UI:
   - Icon EventIcon
   - Mesaj "Nu există evenimente înregistrate"
   - Buton "Reîncarcă"

### Test 4: LocalStorage Persistence
1. Load evenimente
2. Refresh browser (F5)
3. Verify evenimente apar instant (din localStorage)
4. Verify apoi API call pentru update

### Test 5: Client Name Display
1. Verify Chip verde pentru evenimente ale clientului curent
2. Verify Chip gri pentru evenimente ale altor clienți
3. Verify nume client afișat corect

---

## Error Handling

### Scenarii

**1. API Error**
```javascript
catch (error) {
  console.error('Failed to load event types:', error);
  enqueueSnackbar('Eroare la încărcarea evenimentelor', {
    variant: 'error'
  });
}
```

**2. LocalStorage Error**
```javascript
try {
  localStorage.setItem('registeredEventTypes', JSON.stringify(eventTypes));
} catch (error) {
  console.error('[eventTypeService.saveToLocalStorage] Error:', error);
}
```

**3. Parse Error**
```javascript
try {
  const eventTypes = JSON.parse(stored);
  return eventTypes;
} catch (error) {
  console.error('[eventTypeService.loadFromLocalStorage] Error:', error);
  return [];
}
```

---

## Debugging și Monitoring

### Console Logs Backend

Backend afișează logs detaliate pentru fiecare request/response:

**1. Request Log**
```
[GATEWAY] Event Types Discovery Request:
  URL: http://localhost:8081/api/v1/event-types/discover
  Params: {
    "excludeClientId": "da6abcfe-bb06-4adc-902b-e4930fef1bf4"
  }
```

**2. Response Log (Success)**
```
[GATEWAY] Event Types Discovery Response:
  Status: 200
  Total Events: 2
  Event Types: [
    {
      "eventId": "d8f8dd7a-f1ed-425f-8d40-149e597167da",
      "clientId": "da6abcfe-bb06-4adc-902b-e4930fef1bf4",
      "eventType": "order.created",
      "eventDescription": "Event triggered when a new order is created",
      "createdAt": "2026-02-05T21:17:41.844411"
    },
    {
      "eventId": "5409ee84-d60b-48d6-a949-c3debbd4ed77",
      "clientId": "da6abcfe-bb06-4adc-902b-e4930fef1bf4",
      "eventType": "order.deleted",
      "eventDescription": "Event triggered when a order is deleted",
      "createdAt": "2026-02-05T21:33:16.180819"
    }
  ]
```

**3. Error Log**
```
[GATEWAY] Event Types Discovery Error:
  Status: 500
  Message: Request failed with status code 500
  Data: {
    "error": "Internal server error",
    "details": "..."
  }
```

### Console Logs Frontend

Frontend loghează operațiunile cu localStorage:

**1. Load from LocalStorage**
```
[EventsPage] Loaded from localStorage: 2
```

**2. Save to LocalStorage**
```
[eventTypeService] Event types salvate în localStorage: 2
```

**3. Clear LocalStorage**
```
[eventTypeService] localStorage cleared
```

**4. Load from LocalStorage (Service)**
```
[eventTypeService] Event types încărcate din localStorage: 2
```

### Troubleshooting cu Logs

**Problem: Nu apar evenimente**

1. **Check Backend logs:**
   ```
   [GATEWAY] Event Types Discovery Request: ...
   [GATEWAY] Event Types Discovery Response: Total Events: 0
   ```
   → Gateway returnează 0 evenimente

2. **Check Frontend logs:**
   ```
   [EventsPage] Loaded from localStorage: 0
   ```
   → Nu există cache

3. **Soluție:** Verifică că serviciul Java are evenimente înregistrate

**Problem: Eroare la API call**

1. **Check Backend logs:**
   ```
   [GATEWAY] Event Types Discovery Error:
     Status: 404
     Message: Request failed with status code 404
   ```
   → Gateway-ul nu răspunde sau endpoint greșit

2. **Soluție:** Verifică că `wh-svc-gateway:8081` rulează și endpoint-ul este corect

**Problem: Date învechite**

1. **Check localStorage:**
   ```javascript
   localStorage.getItem('registeredEventTypes')
   ```

2. **Clear cache:**
   ```javascript
   eventTypeService.clearLocalStorage()
   ```

3. **Refresh:** Click buton Refresh în UI

---

## Future Enhancements

- [ ] Paginare pentru liste mari
- [ ] Sortare după coloane (eventType, createdAt)
- [ ] Filtrare după tip eveniment
- [ ] Search functionality
- [ ] Export la CSV/JSON
- [ ] Delete evenimente din listă
- [ ] Edit descriere evenimente
- [ ] Statistici evenimente (chart)
- [ ] Real-time updates prin WebSocket

---

## Integrare cu Client Config

```javascript
const { clientInfo } = useClient();

// Folosește UID-ul pentru a obține evenimentele clientului
const response = await eventTypeService.getClientEventTypes(clientInfo.uid);

// Afișează numele clientului în Chip
const getClientName = (clientId) => {
  if (clientInfo && clientInfo.uid === clientId) {
    return clientInfo.name; // "US"
  }
  return clientId; // UUID
};
```

---

**Versiune:** 1.0  
**Data:** 06 Februarie 2026  
**Status:** ✅ Implementat complet
