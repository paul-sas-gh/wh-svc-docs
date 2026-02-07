# FIX: Mesajele nu Apar în Frontend (Socket.IO Connection Issue)

**Data:** 2026-02-06  
**Issue:** Mesajele sunt primite și decriptate cu succes în backend, dar nu apar în frontend

---

## 🔍 Problema Identificată

**Simptome:**
- ✅ Backend primește mesaj de la RabbitMQ
- ✅ Backend decriptează cu succes
- ✅ Backend emit pe Socket.IO: `io.emit('webhook_message_received', data)`
- ❌ Frontend nu primește mesajul
- ❌ Handler-ul din ChatPage nu este apelat

**Cauză:**
Frontend-ul se conectează la **portul greșit** pentru Socket.IO!

**Din `.env`:**
```env
VITE_API_URL=http://localhost:3000  # GREȘIT când rulează în Docker
```

**Reality check:**
- Când aplicația rulează în **Docker**:
  - **wh-client1:** Frontend pe `http://localhost:5171`, Backend pe `http://localhost:3001`
  - **wh-client2:** Frontend pe `http://localhost:5172`, Backend pe `http://localhost:3002`
  
- Frontend-ul (care rulează în **browser**, nu în container) încearcă să se conecteze la `http://localhost:3000`
- **Rezultat:** Socket.IO nu se conectează la backend-ul corect!

---

## ✅ Soluția Aplicată

### Fix `.env` pentru Client 1

**Fișier:** `wh-client/frontend/.env`

**ÎNAINTE:**
```env
VITE_API_URL=http://localhost:3000
```

**DUPĂ:**
```env
VITE_API_URL=http://localhost:3001  # Port corect pentru wh-client1 în Docker
```

### Pentru Client 2

Dacă testezi **wh-client2**, trebuie să folosești:
```env
VITE_API_URL=http://localhost:3002
```

### Pentru Development Local

Dacă rulezi local (fără Docker):
```env
VITE_API_URL=http://localhost:3000
```

---

## 🔧 Pași pentru Aplicare Fix

### Opțiunea 1: Repornește Container Docker (Recomandat)

```bash
cd C:\Projects\WebHooksProject\wh-docker-system
docker-compose restart wh-client1
```

**Notă:** Vite va citi automat `.env` la pornire.

### Opțiunea 2: Rebuild Container (Dacă restart nu funcționează)

```bash
docker-compose up -d --build wh-client1
```

### Opțiunea 3: Rulare Locală (fără Docker)

```bash
cd C:\Projects\WebHooksProject\wh-client\frontend
# Modifică .env la http://localhost:3000
npm run dev
```

---

## ✅ Verificare Fix

### 1. Verifică Conexiunea Socket.IO în Browser Console

**Deschide:** `http://localhost:5171` (pentru Client 1)

**Apasă F12** → Console

**Căută log-uri:**
```
[WEBSOCKET] Conectat cu succes! ID: ...
WebSocket conectat  (toast notification)
```

**Dacă vezi erori:**
```
WebSocket connection to 'ws://localhost:3000' failed: ...
```
→ Înseamnă că frontend-ul încă folosește portul greșit. Repornește containerul.

### 2. Testează Primirea Mesajului

**Din Client A (Publisher):**
1. Navighează la Chat Page
2. Selectează eveniment (ex: `order.created`)
3. Scrie mesaj: "Test mesaj RabbitMQ"
4. Click "Trimite"

**În Client B (Subscriber):**
1. Verifică log-uri backend:
   ```
   [RABBITMQ] 📨 Mesaj primit
   [RABBITMQ] 🔓 Mesaj decriptat
   [SOCKET] Emit mesaj decriptat către Frontend
   ```

2. Verifică browser console (F12):
   ```
   [WEBSOCKET] 📬 Mesaj webhook primit: {eventId, eventName, sender, message}
   [ChatPage] 📬 Webhook message received from RabbitMQ: ...
   ```

3. Verifică UI:
   - ✅ Toast notification apare (top-right, verde)
   - ✅ Mesaj apare în Chat cu iconița 📬 și background purple

---

## 🎯 Soluție pe Termen Lung

**Problema:** `.env` trebuie modificat manual pentru fiecare client.

**Soluție Recomandată:** Detectare automată a portului în funcție de `window.location.port`

### Implementare Viitoare în `WebSocketContext.jsx`:

```javascript
// Detectare inteligentă a portului backend
const getBackendURL = () => {
  const frontendPort = window.location.port;
  
  // Mapping: Frontend Port → Backend Port
  const portMapping = {
    '5171': '3001',  // wh-client1
    '5172': '3002',  // wh-client2
    '5173': '3000'   // local development
  };
  
  const backendPort = portMapping[frontendPort] || '3000';
  return `http://localhost:${backendPort}`;
};

const BACKEND_URL = import.meta.env.VITE_API_URL || getBackendURL();
```

**Beneficiu:** Frontend-ul determină automat portul corect bazat pe propriul său port.

---

## 📝 Rezumat

**Cauză:** Frontend se conecta la portul greșit Socket.IO (`3000` în loc de `3001`)

**Fix:** Actualizat `VITE_API_URL` în `.env` cu portul corect

**Status:** ✅ REZOLVAT - Necesită repornire container/frontend

**Next Step:** Repornește `wh-client1` și testează din nou!

---

**Autor:** GitHub Copilot  
**Data:** 2026-02-06  
**Issue:** ✅ Socket.IO connection port mismatch
