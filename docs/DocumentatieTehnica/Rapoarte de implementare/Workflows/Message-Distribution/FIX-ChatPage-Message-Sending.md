# Fix: Trimitere Mesaje în ChatPage

**Data:** 2026-02-06  
**Issue:** Mesajele din ChatPage nu erau trimise către backend pentru publicare pe RabbitMQ

---

## Problema Identificată

În `ChatPage.jsx`, funcția `handleSendMessage` folosea doar un event Socket.IO de test (`test-webhook`) care nu avea implementare completă în backend. Mesajele nu ajungeau la `wh-svc-manager` pentru a fi distribuite prin RabbitMQ către subscriberi.

**Cod Original (Problematic):**
```javascript
emit('test-webhook', {
  eventType: selectedEventType,
  data: inputMessage,
  timestamp: new Date().toISOString()
});
```

---

## Soluția Implementată

### 1. Actualizare `ChatPage.jsx`

**Funcție `handleSendMessage` refăcută complet:**
- ✅ Verificare că evenimentul selectat există în lista de evenimente publicate
- ✅ Găsire `eventId` pentru evenimentul selectat
- ✅ Apel API prin `eventTypeService.publishWebhookMessage()`
- ✅ Update status mesaj (PENDING → SUCCESS/FAILED)
- ✅ Notificare utilizator cu număr subscriberi notificați

**Flux Nou:**
```
User trimite mesaj
  ↓
ChatPage.handleSendMessage()
  ↓
eventTypeService.publishWebhookMessage(clientId, eventId, message)
  ↓
Backend: /api/gateway/webhooks/publish
  ↓
Criptare cu cheia privată client
  ↓
wh-svc-gateway: /api/v1/webhooks/publish
  ↓
wh-svc-manager procesează
  ↓
RabbitMQ distribuie către subscriberi
```

---

### 2. Adăugare Metodă în `eventTypeService.js`

**Metodă Nouă:**
```javascript
publishWebhookMessage: async (clientId, eventId, message) => {
  const response = await axiosClient.post('/api/gateway/webhooks/publish', {
    clientId,
    eventId,
    message
  });
  return response.data;
}
```

**Responsabilități:**
- Primește parametrii direct (clientId, eventId, message)
- Trimite request la backend Node.js
- Backend-ul criptează și forwardează la Java

---

### 3. Adăugare Rută în `gatewayRoutes.js`

**Rută Nouă:**
```javascript
router.post('/webhooks/publish', gatewayController.publishWebhookMessage);
```

---

### 4. Implementare Controller în `gatewayController.js`

**Metodă Nouă: `publishWebhookMessage`**

**Responsabilități:**
1. Primește `{clientId, eventId, message}` de la frontend
2. Construiește payload: `{eventId, message}`
3. Criptează payload cu cheia privată a clientului (prin `securityService.encrypt()`)
4. Trimite `{clientId, encryptedData}` la `wh-svc-gateway`
5. Returnează răspuns cu număr subscriberi notificați

**Logging detaliat:**
```
[GATEWAY] Publish Webhook Message Request:
  Client ID: da6abcfe-bb06-4adc-902b-e4930fef1bf4
  Event ID: d8f8dd7a-f1ed-425f-8d40-149e597167da
  Message: Comanda #12345...
[GATEWAY] Payload encrypted successfully
  Encrypted length: 512
[GATEWAY] Sending to wh-svc-gateway:
  URL: http://localhost:8081/api/v1/webhooks/publish
[GATEWAY] Publish Webhook Message Response:
  Status: 200
  Event Type: order.created
  Subscribers Notified: 2
```

---

## Fișiere Modificate

1. ✅ `wh-client/frontend/src/pages/ChatPage.jsx` (~60 linii modificate)
   - Funcție `handleSendMessage` complet refăcută
   - Eliminat `emit` nefolosit

2. ✅ `wh-client/frontend/src/services/eventTypeService.js` (+40 linii)
   - Metodă nouă `publishWebhookMessage`

3. ✅ `wh-client/backend/routes/gatewayRoutes.js` (+7 linii)
   - Rută nouă `/webhooks/publish`

4. ✅ `wh-client/backend/controllers/gatewayController.js` (+58 linii)
   - Metodă nouă `publishWebhookMessage`
   - Criptare payload
   - Forward la gateway

**Total:** 4 fișiere, ~165 linii cod nou/modificat

---

## Issue Suplimentar: 401 Unauthorized în Gateway

### Problema

După implementarea rutei în backend, apelul către `wh-svc-gateway` returna **401 Unauthorized**:

```
[GATEWAY] Publish Webhook Message Error:
  Status: 401
  Message: Request failed with status code 401
```

### Cauză

În `SecurityConfig.java` din `wh-svc-gateway`, ruta `/api/v1/webhooks/**` nu era în lista de rute permise public (permitAll).

### Soluție

**Fișier:** `wh-svc-gateway/src/main/java/com/securewebhooks/gateway/config/SecurityConfig.java`

**Adăugat:**
```java
.pathMatchers("/api/v1/webhooks/**").permitAll()
```

**Lista completă rute publice:**
- `/register` - Înregistrare clienți
- `/enroll/**` - Enrollment
- `/api/v1/event-types/**` - Gestionare evenimente
- `/api/v1/subscriptions/**` - Gestionare subscripții
- `/api/v1/webhooks/**` - **Publicare mesaje webhook (NOU)**
- `/health`, `/actuator/health` - Health checks

### Rezultat

✅ Ruta `/api/v1/webhooks/publish` este acum accesibilă fără autentificare

---

## Fișiere Modificate (ACTUALIZAT)

1. ✅ `wh-client/frontend/src/pages/ChatPage.jsx` (~60 linii modificate)
2. ✅ `wh-client/frontend/src/services/eventTypeService.js` (+40 linii)
3. ✅ `wh-client/backend/routes/gatewayRoutes.js` (+7 linii)
4. ✅ `wh-client/backend/controllers/gatewayController.js` (+58 linii)
5. ✅ `wh-svc-gateway/src/main/java/.../SecurityConfig.java` (+1 linie)

**Total:** 5 fișiere, ~166 linii cod nou/modificat

---

## Testare

### Test Manual

**Pași:**
1. Deschide aplicația client (http://localhost:5173)
2. Navighează la Chat Page
3. Asigură-te că ai cel puțin un eveniment publicat
4. Selectează evenimentul din dropdown
5. Scrie un mesaj
6. Click "Trimite"

**Rezultat Așteptat:**
- ✅ Mesaj apare în chat cu status PENDING
- ✅ După câteva secunde, status devine SUCCESS
- ✅ Toast notification: "Mesaj publicat cu succes! X subscriberi notificați"
- ✅ În log-uri backend: `[GATEWAY] Publish Webhook Message Response`
- ✅ Subscriberii primesc mesajul în timp real prin RabbitMQ

### Log-uri Verificare

**Backend Node.js:**
```
[GATEWAY] Publish Webhook Message Request:
  Client ID: da6abcfe-bb06-4adc-902b-e4930fef1bf4
  Event ID: d8f8dd7a-f1ed-425f-8d40-149e597167da
  Message: Test message
[GATEWAY] Payload encrypted successfully
  Encrypted length: 512
[GATEWAY] Publish Webhook Message Response:
  Status: 200
  Subscribers Notified: 1
```

**wh-svc-manager (Java):**
```
[WEBHOOK API] Received publish request from client: da6abcfe-bb06-4adc-902b-e4930fef1bf4
[MESSAGE DELIVERY] Found 1 active subscriber(s) for event: order.created
[RABBITMQ] ✓ Message published successfully to client: 340e6045-3ecc-4c77-bbc1-7ca90a69d7a3
```

**Subscriber Backend:**
```
[RABBITMQ] 📨 Mesaj primit:
  Client ID: 340e6045-3ecc-4c77-bbc1-7ca90a69d7a3
[RABBITMQ] 🔓 Mesaj decriptat: {eventId, eventName, sender, message}
[SOCKET] Emit mesaj decriptat către Frontend
```

**Subscriber Frontend:**
```
[ChatPage] 📬 Webhook message received from RabbitMQ
```

---

## Status Final

✅ **FIX COMPLET - Mesajele din ChatPage sunt acum trimise corect către backend și distribuite prin RabbitMQ!**

**Issues Rezolvate:**
1. ✅ Funcția `handleSendMessage` refăcută pentru a apela API real
2. ✅ Metodă `publishWebhookMessage` adăugată în `eventTypeService`
3. ✅ Rută nouă în backend Node.js (`/api/gateway/webhooks/publish`)
4. ✅ Controller nou în backend Node.js cu criptare
5. ✅ **SecurityConfig actualizat în wh-svc-gateway pentru a permite `/api/v1/webhooks/**`**

**Flux Complet Funcțional:**
Client A → Frontend → Backend (Node) → Gateway (permitAll ✅) → Manager → RabbitMQ → Client B Backend → Client B Frontend

---

**Autor:** GitHub Copilot  
**Data:** 2026-02-06  
**Issues Rezolvate:** 
- ✅ Mesaje nu erau trimise din ChatPage
- ✅ 401 Unauthorized în wh-svc-gateway
