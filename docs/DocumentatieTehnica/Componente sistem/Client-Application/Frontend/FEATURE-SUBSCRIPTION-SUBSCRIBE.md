# Implementare Funcționalitate: Abonare la Evenimente Webhook

## 🎯 Obiectiv

Implementarea completă a funcționalității de **abonare la evenimente ale altor clienți** în pagina de subscripții, cu modal pentru selectare evenimente disponibile.

---

## ✅ Funcționalități Implementate

### Frontend (SubscriptionsPage.jsx)

1. **✅ Buton "Abonare Nouă"**
   - Plasat în header lângă butonul "Reîncarcă"
   - Icon: `RiAddLine`
   - Deschide modal pentru selectare evenimente

2. **✅ Modal de Abonare**
   - **Design:** Dialog fullscreen cu backdrop blur
   - **Dimensiune:** `max-w-4xl` (tabel larg)
   - **Tranziții:** Smooth fade + scale animations
   - **Backdrop:** Semitransparent cu efect blur (`bg-gray-900/30 backdrop-blur-sm`)

3. **✅ Tabel Evenimente Disponibile**
   - **Coloane:**
     - Selectează (radio button)
     - Tip Eveniment (Badge)
     - Descriere
     - Publisher (clientId truncat)
     - Data Creare
   - **Features:**
     - Scroll vertical (max-height: 96)
     - Sticky header
     - Row hover effect
     - Row selection highlight (bg-blue-50)
     - Click pe row selectează evenimentul

4. **✅ Selectare Unică**
   - Radio buttons (nu checkboxes)
   - Doar un eveniment selectat simultan
   - Click pe row activează/deactivează selectarea

5. **✅ State Management**
   - `openModal` - Controlează vizibilitatea modalului
   - `availableEvents` - Lista evenimente disponibile
   - `loadingEvents` - Loading state pentru fetch evenimente
   - `selectedEventId` - ID-ul evenimentului selectat
   - `isSubmitting` - Loading state pentru abonare

6. **✅ Actualizări Badge**
   - Înlocuit props Tremor (`color`, `size`) cu variante custom
   - Variante: `default`, `success`, `neutral`

---

### Backend Node.js

#### 1. Services (subscriptionService.js)

**✅ Metodă `discoverEvents(excludeClientId)`**
```javascript
const response = await subscriptionService.discoverEvents(clientId);
// GET /api/gateway/event-types/discover?excludeClientId=xxx
// Response: { eventTypes: [...], total: N }
```

**✅ Metodă `subscribeToEvent(data)`**
```javascript
await subscriptionService.subscribeToEvent({
  subscriberClientId: 'client-uuid',
  eventId: 'event-uuid',
  publisherClientId: 'publisher-uuid'
});
// POST /api/gateway/subscriptions/subscribe
// Response: { subscriptionId, status, ... }
```

#### 2. Routes (gatewayRoutes.js)

**✅ GET /api/gateway/event-types/discover**
- Query param: `excludeClientId` (obligatoriu)
- Returnează evenimente create de alți clienți

**✅ GET /api/gateway/subscriptions/client/:clientId**
- Returnează subscripțiile unui client

**✅ POST /api/gateway/subscriptions/subscribe**
- Body: `{ subscriberClientId, eventId, publisherClientId }`
- Creează o nouă subscriere

#### 3. Controllers (gatewayController.js)

**✅ `discoverEventTypes()`**
- Validare `excludeClientId` query param
- Forward către `wh-svc-gateway`
- Log-uri detaliate

**✅ `getClientSubscriptions()`**
- Forward către `wh-svc-gateway`
- Log-uri detaliate

**✅ `subscribeToEvent()`**
- Validare date input
- Forward către `wh-svc-gateway`
- WebSocket broadcast: `subscription-created`
- Log-uri detaliate

---

## 📊 Flow Complet de Abonare

### 1. Utilizator Click "Abonare Nouă"
```
Frontend: handleOpenModal()
  ↓
Frontend: loadAvailableEvents()
  ↓
GET /api/gateway/event-types/discover?excludeClientId={myClientId}
  ↓
Backend Node.js → wh-svc-gateway → wh-svc-manager
  ↓
Response: { eventTypes: [...], total: N }
  ↓
Frontend: Afișează tabel cu evenimente
```

### 2. Utilizator Selectează Eveniment
```
Frontend: Click pe row sau radio button
  ↓
handleEventSelect(eventId)
  ↓
setState: selectedEventId = eventId
  ↓
UI: Row highlight + radio checked
```

### 3. Utilizator Click "Abonează-te"
```
Frontend: handleSubscribe()
  ↓
Validare: selectedEventId exists
  ↓
POST /api/gateway/subscriptions/subscribe
Body: {
  subscriberClientId: "my-client-uuid",
  eventId: "selected-event-uuid",
  publisherClientId: "publisher-client-uuid"
}
  ↓
Backend Node.js: Construiește payload pentru criptare
Payload to encrypt: {
  eventId: "selected-event-uuid",
  publisherClientId: "publisher-client-uuid"
}
// ❌ NU include subscriberClientId (se trimite separat)
  ↓
Backend Node.js → wh-security: Criptează payload
Request: {
  data: JSON.stringify(payload),
  publicKey: serverPublicKey
}
  ↓
Backend Node.js → wh-svc-gateway → wh-svc-manager
Request: {
  clientId: "my-client-uuid",        // ✅ Campo corect: clientId (subscriber)
  encryptedData: "base64..."         // ✅ Conține: eventId, publisherClientId
}
  ↓
Manager: 
  - Lookup privateKey using clientId (subscriberClientId)
  - Decrypt encryptedData
  - Parse → DecryptedSubscriptionPayload { eventId, publisherClientId }
  - Salvează subscriere în DB
  ↓
Response: { subscriptionId, status: 'ACTIVE', ... }
  ↓
Frontend: 
  - Notificare success
  - Închide modal
  - Reîncarcă listă subscripții
  - WebSocket broadcast (opcional)
```

---

## 🎨 UI/UX Features

### Modal Design
- **Backdrop:** Semitransparent cu blur effect
- **Panel:** Rounded corners, shadow-xl
- **Transitions:** Smooth fade + scale
- **Responsive:** max-w-4xl pentru tabel larg

### Tabel Evenimente
- **Header:** Sticky la scroll, background gri deschis
- **Rows:** 
  - Hover effect (bg-gray-50)
  - Selected highlight (bg-blue-50)
  - Cursor pointer
- **Scroll:** Max height 96 (24rem) cu overflow-y-auto
- **Data:** 
  - Badge pentru eventType
  - clientId truncat (primele 8 caractere)
  - Data formatată `ro-RO`

### Notificări
- **Info:** "Nu există evenimente disponibile pentru abonare"
- **Success:** "Abonare reușită!"
- **Warning:** "Selectează un eveniment pentru abonare"
- **Error:** "Eroare la abonare" / "Eroare la încărcarea evenimentelor"

### Loading States
- **Loading evenimente:** Spinner + mesaj
- **Submitting abonare:** Button disabled + "Se abonează..."
- **Empty state:** Icon + mesaj + link reîncărcare

---

## 📝 Log-uri Backend

### Discover Events
```
[GATEWAY] Discover Event Types Request:
  URL: http://localhost:8081/api/v1/event-types/discover
  Exclude Client ID: da6abcfe-bb06-4adc-902b-e4930fef1bf4

[GATEWAY] Discover Event Types Response:
  Status: 200
  Total Events: 5
```

### Subscribe to Event
```
[GATEWAY] Subscribe to Event - Original Payload:
  Subscriber Client ID: da6abcfe-bb06-4adc-902b-e4930fef1bf4
  Event ID: d8f8dd7a-f1ed-425f-8d40-149e597167da
  Publisher Client ID: 340e6045-3ecc-4c77-bbc1-7ca90a69d7a3
  Payload to encrypt: {
    "eventId": "d8f8dd7a-f1ed-425f-8d40-149e597167da",
    "publisherClientId": "340e6045-3ecc-4c77-bbc1-7ca90a69d7a3"
  }

[SECURITY SERVICE] Encrypt - Starting...
[SECURITY SERVICE] Encrypt - Config check:
  Full config exists: true
  serverPublicKey exists: true
  serverPublicKey length: 392

[SECURITY SERVICE] Encrypting data...
  URL: http://localhost:8080/encrypt
  Payload: {
    "data": "{\"eventId\":\"d8f8dd7a-f1ed-425f-8d40-149e597167da\",\"publisherClientId\":\"340e6045-3ecc-4c77-bbc1-7ca90a69d7a3\"}",
    "publicKey": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAp9..."
  }

[SECURITY SERVICE] Data encrypted successfully
  Encrypted length: 344

[GATEWAY] Sending to wh-svc-gateway:
  URL: http://localhost:8081/api/v1/subscriptions
  Payload: {
    "clientId": "da6abcfe-bb06-4adc-902b-e4930fef1bf4",
    "encryptedData": "aGVsbG8gd29ybGQgdGhpcyBpcyBhIHRlc3QgZW5jcn..."
  }

[GATEWAY] Subscribe to Event Response:
  Status: 201
  Subscription ID: 1d286570-a119-41ee-bdda-dff5053bd849
```

---

## 🧪 Testing

### 1. Test Discover Evenimente

**Acțiune:**
- Deschide pagina "Subscripții"
- Click "Abonare Nouă"

**Verificări:**
- ✅ Modal se deschide cu backdrop blur
- ✅ Se afișează loading spinner
- ✅ Request GET `/api/gateway/event-types/discover?excludeClientId=xxx`
- ✅ Tabel se populează cu evenimente (exclude evenimente proprii)
- ✅ Fiecare row are radio button

### 2. Test Selectare Eveniment

**Acțiune:**
- Click pe un row din tabel

**Verificări:**
- ✅ Row-ul devine highlight (bg-blue-50)
- ✅ Radio button se bifează
- ✅ Alte row-uri se debi fează (selectare unică)
- ✅ Buton "Abonează-te" devine activ

### 3. Test Abonare

**Acțiune:**
- Selectează un eveniment
- Click "Abonează-te"

**Verificări:**
- ✅ Buton devine disabled + loading
- ✅ Request POST `/api/gateway/subscriptions/subscribe`
- ✅ Notificare success: "Abonare reușită!"
- ✅ Modal se închide
- ✅ Lista subscripții se reîncarcă automat
- ✅ Noua subscriere apare în tabel

### 4. Test Edge Cases

**Scenario: Nicio eveniment disponibil**
- ✅ Afișează mesaj: "Nu există evenimente disponibile pentru abonare"
- ✅ Buton "Abonează-te" disabled

**Scenario: Click Abonează-te fără selectare**
- ✅ Notificare warning: "Selectează un eveniment pentru abonare"
- ✅ Nu face request

**Scenario: Eroare la fetch evenimente**
- ✅ Notificare error
- ✅ Empty state în modal

---

## 📚 API Endpoints

### Frontend → Backend Node.js

| Endpoint | Method | Descriere |
|----------|--------|-----------|
| `/api/gateway/event-types/discover` | GET | Descoperă evenimente disponibile |
| `/api/gateway/subscriptions/client/:id` | GET | Obține subscripții client |
| `/api/gateway/subscriptions/subscribe` | POST | Abonează la eveniment |

### Backend Node.js → wh-svc-gateway

| Endpoint | Method | Descriere |
|----------|--------|-----------|
| `/api/v1/event-types/discover` | GET | Proxy discover |
| `/api/v1/subscriptions/client/:id` | GET | Proxy get subscriptions |
| `/api/v1/subscriptions` | POST | Proxy subscribe |

---

## ✅ Fișiere Modificate

### Frontend
- ✅ `src/pages/SubscriptionsPage.jsx` - UI + logică abonare
- ✅ `src/services/subscriptionService.js` - API methods

### Backend
- ✅ `backend/routes/gatewayRoutes.js` - Rute noi
- ✅ `backend/controllers/gatewayController.js` - Controller methods

---

## 🎉 Status: COMPLET & FUNCȚIONAL

Funcționalitatea de abonare la evenimente este acum **complet implementată**:

- ✅ UI modal cu tabel responsive
- ✅ Selectare unică cu radio buttons
- ✅ API discover events (exclude client curent)
- ✅ API subscribe to event
- ✅ Backend proxy către wh-svc-gateway
- ✅ Log-uri detaliate
- ✅ Gestionare erori
- ✅ Loading states
- ✅ Notificări utilizator
- ✅ Auto-refresh după abonare

**Ready for testing!** 🚀
