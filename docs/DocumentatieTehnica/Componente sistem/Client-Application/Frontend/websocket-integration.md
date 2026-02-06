# WebSocket Integration - Frontend

## Prezentare Generală

Frontend-ul utilizează **Socket.io-client** pentru comunicare bidirectională în timp real cu Backend-ul BFF. Acest document descrie implementarea completă a WebSocket Context și integrarea în aplicație.

---

## Arhitectură WebSocket

```
┌──────────────────────────────────────────────┐
│         React Components (UI)                 │
│  - useWebSocket() hook                        │
│  - Acces la: connected, emit, on, off        │
└──────────────────────────────────────────────┘
                    ▲
                    │ Context API
                    ▼
┌──────────────────────────────────────────────┐
│      WebSocketContext Provider                │
│  - Socket.io client initialization            │
│  - Event listeners (11 evenimente)            │
│  - State management (socket, connected)       │
│  - Notistack integration                      │
└──────────────────────────────────────────────┘
                    ▲
                    │ WebSocket Protocol
                    ▼
┌──────────────────────────────────────────────┐
│    Backend BFF (Socket.io Server)             │
│  Port: 3000                                    │
└──────────────────────────────────────────────┘
```

---

## WebSocketContext Implementation

### Fișier: `src/context/WebSocketContext.jsx`

### Configurare Socket.io Client

```javascript
const socketInstance = io(BACKEND_URL, {
  reconnection: true,              // Reconectare automată
  reconnectionDelay: 1000,        // 1 secundă între încercări
  reconnectionDelayMax: 5000,     // Max 5 secunde delay
  reconnectionAttempts: 5,        // Max 5 încercări
  transports: ['websocket', 'polling']  // Fallback la polling
});
```

**BaseURL:** `import.meta.env.VITE_API_URL` sau `http://localhost:3000`

---

## Evenimente Socket.io Gestionate

### 1. Evenimente Built-in (Socket.io)

#### connect
**Trigger:** Conexiune reușită la server

**Handler:**
```javascript
socketInstance.on('connect', () => {
  console.log('[WEBSOCKET] Conectat! ID:', socketInstance.id);
  setConnected(true);
  enqueueSnackbar('WebSocket conectat', { 
    variant: 'info',
    autoHideDuration: 2000 
  });
});
```

**Notificare:** Toast albastru "WebSocket conectat" (2s)

#### disconnect
**Trigger:** Conexiune pierdută

**Handler:**
```javascript
socketInstance.on('disconnect', (reason) => {
  console.log('[WEBSOCKET] Deconectat. Motiv:', reason);
  setConnected(false);
  enqueueSnackbar('WebSocket deconectat', { 
    variant: 'warning',
    autoHideDuration: 3000 
  });
});
```

**Motive posibile:**
- `io server disconnect` - Server a închis conexiunea
- `io client disconnect` - Client a închis conexiunea (manual)
- `ping timeout` - Server nu răspunde la ping
- `transport close` - Conexiune întreruptă

#### connect_error
**Trigger:** Eroare la conectare

**Handler:**
```javascript
socketInstance.on('connect_error', (error) => {
  console.error('[WEBSOCKET] Eroare conexiune:', error.message);
  enqueueSnackbar('Eroare conexiune WebSocket', { 
    variant: 'error',
    autoHideDuration: 4000 
  });
});
```

**Notificare:** Toast roșu "Eroare conexiune WebSocket"

#### reconnect
**Trigger:** Reconectare reușită după disconnect

**Handler:**
```javascript
socketInstance.on('reconnect', (attemptNumber) => {
  console.log('[WEBSOCKET] Reconectat după', attemptNumber, 'încercări');
  enqueueSnackbar('WebSocket reconectat', { 
    variant: 'success',
    autoHideDuration: 2000 
  });
});
```

#### reconnect_attempt
**Trigger:** Încercare de reconectare în curs

**Handler:**
```javascript
socketInstance.on('reconnect_attempt', (attemptNumber) => {
  console.log('[WEBSOCKET] Încearcă reconectarea...', attemptNumber);
});
```

**Nota:** Doar log console, fără notificare UI (pentru a nu spam-ui utilizatorul).

#### reconnect_failed
**Trigger:** Toate încercările de reconectare au eșuat

**Handler:**
```javascript
socketInstance.on('reconnect_failed', () => {
  console.error('[WEBSOCKET] Reconectare eșuată după multiple încercări');
  enqueueSnackbar('Nu se poate reconecta la server', { 
    variant: 'error',
    autoHideDuration: 5000 
  });
});
```

### 2. Evenimente Custom (Business Logic)

#### pong
**Trigger:** Răspuns de la server la ping (test conexiune)

**Handler:**
```javascript
socketInstance.on('pong', (data) => {
  console.log('[WEBSOCKET] Pong primit:', data);
  // { timestamp: "2026-02-06T10:00:00Z", message: "Server activ" }
});
```

**Utilizare:** Test manual conexiune prin buton UI.

#### client-registered
**Trigger:** Backend broadcast când un client nou este înregistrat

**Payload:**
```javascript
{
  "clientId": 123,
  "clientName": "MyCompany",
  "timestamp": "2026-02-06T10:00:00Z"
}
```

**Handler:**
```javascript
socketInstance.on('client-registered', (data) => {
  console.log('[WEBSOCKET] Client înregistrat:', data);
  enqueueSnackbar(`Client "${data.clientName}" înregistrat cu succes!`, { 
    variant: 'success',
    autoHideDuration: 4000 
  });
});
```

**Notificare:** Toast verde cu nume client

#### webhook-retry
**Trigger:** Backend broadcast când un webhook eșuat este reîncercat

**Payload:**
```javascript
{
  "eventId": 789,
  "status": "RETRYING",
  "timestamp": "2026-02-06T10:00:00Z"
}
```

**Handler:**
```javascript
socketInstance.on('webhook-retry', (data) => {
  console.log('[WEBSOCKET] Webhook retry:', data);
  enqueueSnackbar(`Webhook #${data.eventId} în curs de reîncercare`, { 
    variant: 'info',
    autoHideDuration: 3000 
  });
});
```

#### webhook-event
**Trigger:** Backend broadcast când un webhook este processat

**Payload:**
```javascript
{
  "type": "WEBHOOK_EVENT",
  "timestamp": "2026-02-06T10:00:00Z",
  "payload": {
    "status": "SUCCESS",  // sau "FAILED"
    "details": "Webhook processed successfully"
  }
}
```

**Handler:**
```javascript
socketInstance.on('webhook-event', (data) => {
  console.log('[WEBSOCKET] Webhook event:', data);
  
  const variant = data.payload?.status === 'SUCCESS' ? 'success' : 'error';
  const message = data.payload?.details || 'Eveniment webhook primit';
  
  enqueueSnackbar(message, { 
    variant: variant,
    autoHideDuration: 4000 
  });
});
```

**Notificare:** Verde (success) sau Roșu (failed)

#### system-message
**Trigger:** Backend trimite mesaje sistem (maintenance, updates, etc.)

**Payload:**
```javascript
{
  "message": "Server maintenance în 5 minute",
  "timestamp": "2026-02-06T10:00:00Z"
}
```

**Handler:**
```javascript
socketInstance.on('system-message', (data) => {
  console.log('[WEBSOCKET] Mesaj sistem:', data);
  enqueueSnackbar(data.message || 'Mesaj sistem', { 
    variant: 'info',
    autoHideDuration: 3000 
  });
});
```

---

## Hook useWebSocket

### API Export

```javascript
const {
  socket,      // Instanța Socket.io
  connected,   // Boolean: true/false
  emit,        // Function(eventName, data)
  on,          // Function(eventName, callback)
  off,         // Function(eventName, callback)
  ping,        // Function() - test conexiune
  joinRoom     // Function(roomName) - alătură room
} = useWebSocket();
```

### Metode Disponibile

#### emit(eventName, data)
**Scop:** Trimite eveniment către server

**Exemplu:**
```javascript
const { emit } = useWebSocket();

emit('custom-event', {
  userId: 123,
  action: 'click_button'
});
```

**Verificare conexiune:** Metodă verifică dacă socket este conectat înainte de a trimite.

#### on(eventName, callback)
**Scop:** Ascultă evenimente de la server

**Exemplu:**
```javascript
const { on, off } = useWebSocket();

useEffect(() => {
  const handleCustomEvent = (data) => {
    console.log('Eveniment primit:', data);
  };
  
  on('custom-event', handleCustomEvent);
  
  // Cleanup
  return () => {
    off('custom-event', handleCustomEvent);
  };
}, [on, off]);
```

#### ping()
**Scop:** Test conexiune (trimite ping către server)

**Exemplu:**
```javascript
const { ping } = useWebSocket();

const handleTestConnection = () => {
  ping();
  // Server va răspunde cu 'pong' event
};
```

#### joinRoom(roomName)
**Scop:** Alătură-te unui room (grup de clienți)

**Exemplu:**
```javascript
const { joinRoom } = useWebSocket();

useEffect(() => {
  joinRoom(`client-${clientId}`);
  // Primești doar evenimente pentru acest client
}, [clientId, joinRoom]);
```

---

## Integrare în App.jsx

### Provider Setup

```javascript
import { WebSocketProvider } from './context/WebSocketContext';

function App() {
  return (
    <SnackbarProvider>
      <WebSocketProvider>
        {/* App content */}
      </WebSocketProvider>
    </SnackbarProvider>
  );
}
```

**Ordinea:** SnackbarProvider → WebSocketProvider (WebSocket Context are nevoie de Notistack)

### Indicator Status Conexiune

```javascript
import { useWebSocket } from './context/WebSocketContext';
import { WifiIcon, WifiOffIcon } from '@mui/icons-material';
import { Chip } from '@mui/material';

function ConnectionIndicator() {
  const { connected } = useWebSocket();

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      {connected ? (
        <>
          <WifiIcon color="success" />
          <Chip label="WebSocket Conectat" color="success" size="small" />
        </>
      ) : (
        <>
          <WifiOffIcon color="error" />
          <Chip label="WebSocket Deconectat" color="error" size="small" />
        </>
      )}
    </Box>
  );
}
```

---

## Utilizare în Componente

### Exemplu 1: Listen pentru evenimente client-registered

```javascript
import { useEffect } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

function ClientList() {
  const { on, off } = useWebSocket();
  const [clients, setClients] = useState([]);

  useEffect(() => {
    const handleNewClient = (data) => {
      console.log('Client nou:', data.clientName);
      
      // Refresh lista clienților
      fetchClients();
      
      // Sau adaugă direct în state
      setClients(prev => [...prev, data]);
    };

    on('client-registered', handleNewClient);

    return () => {
      off('client-registered', handleNewClient);
    };
  }, [on, off]);

  return (
    // ... JSX
  );
}
```

### Exemplu 2: Real-time Event Log

```javascript
function EventLog() {
  const { on, off } = useWebSocket();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const handleWebhookEvent = (data) => {
      setEvents(prev => [data, ...prev]); // Adaugă la început
    };

    on('webhook-event', handleWebhookEvent);

    return () => {
      off('webhook-event', handleWebhookEvent);
    };
  }, [on, off]);

  return (
    <Paper>
      <Typography variant="h6">Live Events</Typography>
      <List>
        {events.map((event, index) => (
          <ListItem key={index}>
            <ListItemText 
              primary={event.payload?.details}
              secondary={event.timestamp}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
```

### Exemplu 3: Manual Ping Test

```javascript
function TestWebSocketButton() {
  const { ping, connected } = useWebSocket();
  const { enqueueSnackbar } = useSnackbar();

  const handlePing = () => {
    ping();
    enqueueSnackbar('Ping trimis către server', {
      variant: 'info',
      autoHideDuration: 2000
    });
  };

  return (
    <Button 
      onClick={handlePing}
      disabled={!connected}
      variant="outlined"
    >
      Test Connection
    </Button>
  );
}
```

---

## State Management

### Context State

```javascript
const [socket, setSocket] = useState(null);      // Instanța Socket.io
const [connected, setConnected] = useState(false); // Status conexiune
```

### Lifecycle

1. **Mount:** Inițializare socket, setup listeners
2. **Connect:** `setConnected(true)` + notificare
3. **Disconnect:** `setConnected(false)` + notificare
4. **Reconnect:** Automatic retry (5 încercări)
5. **Unmount:** `socket.disconnect()` + cleanup

---

## Error Handling

### Network Errors

Socket.io gestionează automat:
- **Connection timeout:** Retry automat
- **Transport error:** Fallback la polling
- **Server down:** Reconnection attempts

### User Notifications

Toate erorile sunt notificate prin Notistack:
- `connect_error` → Toast roșu
- `reconnect_failed` → Toast roșu persistent
- `disconnect` → Toast galben warning

---

## Performance Considerations

### 1. **Event Listener Cleanup**
Toate listener-ele trebuie să fie cleaned up în useEffect:

```javascript
useEffect(() => {
  const handler = (data) => { /* ... */ };
  on('event-name', handler);
  
  return () => {
    off('event-name', handler);
  };
}, [on, off]);
```

### 2. **Reconnection Strategy**
- Max 5 încercări cu delay crescător (1s → 5s)
- Evită reconnection loop infinit

### 3. **Message Throttling**
Pentru evenimente frecvente, consideră throttling în componente:

```javascript
import { debounce } from 'lodash';

const handleEvent = debounce((data) => {
  // Process event
}, 1000);
```

---

## Debugging

### Console Logging

WebSocketContext loghează toate evenimentele:

```
[WEBSOCKET] Conectat cu succes! ID: abc123
[WEBSOCKET] Client înregistrat: {clientId: 123, clientName: "..."}
[WEBSOCKET] Deconectat. Motiv: ping timeout
[WEBSOCKET] Încearcă reconectarea... 1
[WEBSOCKET] Reconectat după 2 încercări
```

### Browser DevTools

**Network Tab → WS (WebSocket):**
- Vezi toate mesajele trimise/primite
- Verifică latența
- Monitorizează reconectări

---

## Security Considerations

### 1. **Origin Validation**
Backend verifică origin în configurare CORS:

```javascript
// Backend
cors: {
  origin: config.CORS_ORIGIN, // http://localhost:5173
  methods: ['GET', 'POST']
}
```

### 2. **Authentication (TODO)**
În viitor, Socket.io va trimite JWT token:

```javascript
const socketInstance = io(BACKEND_URL, {
  auth: {
    token: getAuthToken()
  }
});
```

### 3. **Event Validation**
Backend validează toate evenimente primite de la clienți.

---

## Testing

### Test 1: Connection
1. Pornește Backend: `npm run dev` (din backend/)
2. Pornește Frontend: `npm run dev` (din frontend/)
3. Verifică UI: Chip verde "WebSocket Conectat"
4. Check console: `[WEBSOCKET] Conectat cu succes!`

### Test 2: Ping/Pong
1. Click buton "Ping Server"
2. Verifică console: `[WEBSOCKET] Pong primit: {...}`
3. Notificare: "Ping trimis către server"

### Test 3: Reconnection
1. Oprește Backend
2. UI afișează: Chip roșu "WebSocket Deconectat"
3. Pornește Backend
4. UI revine automat la verde "WebSocket Reconectat"

### Test 4: Events
1. Înregistrează un client (HTTP POST)
2. Primești notificare: "Client X înregistrat cu succes!"
3. Check console: `[WEBSOCKET] Client înregistrat: {...}`

---

## Troubleshooting

### Problem: Socket nu se conectează
**Cauze:**
- Backend nu rulează
- Port incorect în VITE_API_URL
- CORS blocat

**Soluție:**
1. Verifică Backend: `curl http://localhost:3000/health`
2. Verifică `.env`: `VITE_API_URL=http://localhost:3000`
3. Check Backend console pentru erori CORS

### Problem: Reconnection infinit loop
**Cauză:** Backend este down permanent

**Soluție:** Pornește Backend sau crește `reconnectionAttempts`

### Problem: Evenimente nu sunt primite
**Cauză:** Listener nu este setat corect sau cleanup prea devreme

**Soluție:** Verifică dependencies în useEffect

---

## Future Enhancements

- [ ] Rooms per client (isolation evenimente)
- [ ] Autentificare JWT pentru WebSocket
- [ ] Compression pentru mesaje mari
- [ ] Binary data support (fișiere)
- [ ] Heartbeat custom (alternative la ping/pong)
- [ ] Event queue pentru offline mode
- [ ] Persistent connection recovery

---

**Versiune documentație:** 1.0  
**Data:** 06 Februarie 2026  
**Ultima actualizare:** Etapa 3 - WebSocket Integration completă
