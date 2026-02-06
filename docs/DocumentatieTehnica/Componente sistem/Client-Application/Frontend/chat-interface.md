# ChatPage - Interfață Chat pentru Evenimente Webhook

## Prezentare Generală

**ChatPage** este o interfață tip chat care permite monitorizarea și trimiterea de evenimente webhook în timp real. Pagina oferă o experiență interactivă similară aplicațiilor de mesagerie, facilitând comunicarea bidirectională prin WebSocket.

---

## Features Principale

### 1. **Afișare Mesaje în Timp Real**
- Primire automată evenimente prin WebSocket
- Afișare mesaje în format chat bubble
- Scroll automat la ultimul mesaj
- Formatare timestamp localizată

### 2. **Trimitere Evenimente**
- Selectare client destinatar
- Selectare tip eveniment din listă predefinită
- Input text pentru conținut mesaj
- Trimitere prin buton Send sau Enter

### 3. **Tipuri de Mesaje**

#### Mesaje Primite (Received)
- **webhook-event:** Evenimente webhook procesate
- **client-registered:** Notificări înregistrare client
- **webhook-retry:** Notificări reîncercare webhook
- **system-message:** Mesaje sistem

#### Mesaje Trimise (Sent)
- Evenimente generate de utilizator
- Afișare în partea dreaptă a chat-ului
- Avatar utilizator

---

## Arhitectură Componentă

```
┌─────────────────────────────────────────────────┐
│              ChatPage Component                  │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │         Header (Titlu + Descriere)         │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │       Messages Area (Scrollable)           │ │
│  │  ┌──────────────────────────────────────┐  │ │
│  │  │  Message Bubble (Received)           │  │ │
│  │  │  - Avatar (Bot/System)               │  │ │
│  │  │  - Chip (EventType + Status)         │  │ │
│  │  │  - Content                           │  │ │
│  │  │  - Timestamp                         │  │ │
│  │  └──────────────────────────────────────┘  │ │
│  │                                              │ │
│  │  ┌──────────────────────────────────────┐  │ │
│  │  │  Message Bubble (Sent)               │  │ │
│  │  │  - Content                           │  │ │
│  │  │  - Timestamp                         │  │ │
│  │  │  - Avatar (User)                     │  │ │
│  │  └──────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │         Input Area                         │ │
│  │  ┌──────────────┐  ┌──────────────┐       │ │
│  │  │ Select Client│  │ Select Event │       │ │
│  │  └──────────────┘  └──────────────┘       │ │
│  │  ┌────────────────────────────────────┐   │ │
│  │  │  TextField (Message Input)         │   │ │
│  │  └────────────────────────────────────┘   │ │
│  │                              [Send Button] │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## State Management

### State Variables

```javascript
const [messages, setMessages] = useState([]);           // Lista mesaje
const [inputMessage, setInputMessage] = useState('');   // Input text
const [selectedEventType, setSelectedEventType] = useState('ORDER_CREATED');
const [selectedClient, setSelectedClient] = useState('');
const messagesEndRef = useRef(null);                    // Ref pentru auto-scroll
```

### Message Object Structure

```javascript
/**
 * @typedef {Object} Message
 * @property {number} id - ID unic mesaj (timestamp)
 * @property {string} type - Tip: 'sent', 'received', 'system'
 * @property {string} eventType - Tip eveniment (ex: ORDER_CREATED)
 * @property {string} content - Conținut mesaj
 * @property {string} status - Status: SUCCESS, FAILED, PENDING, INFO
 * @property {string} timestamp - ISO timestamp
 */
```

---

## WebSocket Integration

### Listeners Evenimente

```javascript
useEffect(() => {
  // Listener pentru evenimente webhook
  const handleWebhookEvent = (data) => {
    const newMessage = {
      id: Date.now(),
      type: 'received',
      eventType: data.type || 'WEBHOOK_EVENT',
      content: data.payload?.details || JSON.stringify(data.payload),
      status: data.payload?.status || 'INFO',
      timestamp: data.timestamp
    };
    setMessages(prev => [...prev, newMessage]);
  };

  on('webhook-event', handleWebhookEvent);
  
  return () => {
    off('webhook-event', handleWebhookEvent);
  };
}, [on, off]);
```

### Emit Evenimente

```javascript
const handleSendMessage = async () => {
  const payload = {
    clientId: selectedClient,
    eventType: selectedEventType,
    data: inputMessage
  };

  emit('test-webhook', {
    ...payload,
    timestamp: new Date().toISOString()
  });
};
```

---

## UI Components

### 1. Messages Area

**Scroll Automat:**
```javascript
const scrollToBottom = () => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
};

useEffect(() => {
  scrollToBottom();
}, [messages]);
```

**Empty State:**
```jsx
{messages.length === 0 && (
  <Box sx={{ textAlign: 'center', py: 8 }}>
    <BotIcon sx={{ fontSize: 80, color: 'text.secondary' }} />
    <Typography>Niciun mesaj</Typography>
  </Box>
)}
```

### 2. Message Bubble

**Received Message (stânga):**
```jsx
<Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
  <Avatar sx={{ bgcolor: 'primary.main' }}>
    <BotIcon />
  </Avatar>
  <Box sx={{ backgroundColor: getMessageColor(status) }}>
    <Chip label={eventType} />
    <Typography>{content}</Typography>
    <Typography variant="caption">{timestamp}</Typography>
  </Box>
</Box>
```

**Sent Message (dreapta):**
```jsx
<Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
  <Box sx={{ backgroundColor: '#1976d2', color: 'white' }}>
    <Chip label={eventType} />
    <Typography>{content}</Typography>
    <Typography variant="caption">{timestamp}</Typography>
  </Box>
  <Avatar sx={{ bgcolor: 'secondary.main' }}>
    <PersonIcon />
  </Avatar>
</Box>
```

### 3. Input Area

**Selectoare:**
```jsx
<FormControl size="small">
  <InputLabel>Client</InputLabel>
  <Select value={selectedClient} onChange={handleChange}>
    {clients.map(client => (
      <MenuItem key={client.id} value={client.id}>
        {client.name}
      </MenuItem>
    ))}
  </Select>
</FormControl>

<FormControl size="small">
  <InputLabel>Tip Eveniment</InputLabel>
  <Select value={selectedEventType} onChange={handleChange}>
    {eventTypes.map(type => (
      <MenuItem key={type} value={type}>{type}</MenuItem>
    ))}
  </Select>
</FormControl>
```

**Input Text:**
```jsx
<TextField
  fullWidth
  multiline
  maxRows={4}
  placeholder="Scrie mesajul evenimentului..."
  value={inputMessage}
  onChange={(e) => setInputMessage(e.target.value)}
  onKeyPress={handleKeyPress}
  disabled={!connected}
/>
```

**Send Button:**
```jsx
<IconButton
  color="primary"
  onClick={handleSendMessage}
  disabled={!connected || !inputMessage.trim()}
>
  <SendIcon />
</IconButton>
```

---

## Styling și Colors

### Message Colors (pe baza status)

```javascript
const getMessageColor = (status) => {
  switch (status) {
    case 'SUCCESS': return '#d4edda';  // Verde deschis
    case 'FAILED':
    case 'ERROR':   return '#f8d7da';  // Roșu deschis
    case 'PENDING': return '#fff3cd';  // Galben deschis
    default:        return '#d1ecf1';  // Albastru deschis
  }
};
```

### Chip Colors

```javascript
const getStatusChipColor = (status) => {
  switch (status) {
    case 'SUCCESS': return 'success';
    case 'FAILED':
    case 'ERROR':   return 'error';
    case 'PENDING': return 'warning';
    default:        return 'info';
  }
};
```

---

## Tipuri Evenimente Disponibile

```javascript
const eventTypes = [
  'ORDER_CREATED',      // Comandă nouă creată
  'ORDER_UPDATED',      // Comandă actualizată
  'ORDER_CANCELLED',    // Comandă anulată
  'CLIENT_REGISTERED',  // Client nou înregistrat
  'PAYMENT_RECEIVED',   // Plată primită
  'PRODUCT_UPDATED'     // Produs actualizat
];
```

---

## Features Avansate

### 1. **Keyboard Shortcuts**
- **Enter:** Trimite mesaj
- **Shift + Enter:** New line în input

```javascript
const handleKeyPress = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
};
```

### 2. **Connection Status**
- Disable input când WebSocket deconectat
- Mesaj warning sub input area
- Reconectare automată

```jsx
{!connected && (
  <Typography variant="caption" color="error">
    WebSocket deconectat. Reconectare în curs...
  </Typography>
)}
```

### 3. **Validare Input**
- Client selection required
- Event type preselected
- Message non-empty

```javascript
if (!inputMessage.trim() || !selectedClient) {
  enqueueSnackbar('Completează toate câmpurile', { variant: 'warning' });
  return;
}
```

---

## User Flow

### Trimitere Mesaj

```
1. User selectează Client din dropdown
2. User selectează Tip Eveniment din dropdown
3. User scrie mesaj în TextField
4. User apasă Send sau Enter
5. Mesaj apare în chat (partea dreaptă, albastru)
6. Event emit prin WebSocket către backend
7. Backend procesează și broadcast
8. Răspuns apare în chat (partea stânga, colorat pe status)
```

### Primire Mesaj

```
1. Backend emit eveniment prin WebSocket
2. Frontend listener interceptează
3. Create message object
4. Add la messages state
5. Auto-scroll la bottom
6. Notificare Snackbar (opțional, gestionată de Context)
```

---

## Testing

### Test 1: Afișare Mesaje Primite
1. Navigate la /chat
2. Backend emit 'webhook-event'
3. Mesaj apare în chat partea stânga
4. Check: Avatar, Chip, Content, Timestamp
✅ **Success**

### Test 2: Trimitere Mesaj
1. Select "DemoClient"
2. Select "ORDER_CREATED"
3. Type: "Comandă #12345"
4. Click Send
5. Mesaj apare partea dreaptă
6. Check console: emit event
✅ **Success**

### Test 3: Auto-scroll
1. Trimite 10+ mesaje
2. Verifică scroll automat la bottom
✅ **Success**

### Test 4: Connection Status
1. Oprește Backend
2. Input disabled
3. Warning message visible
4. Pornește Backend
5. Input enabled
✅ **Success**

---

## Performance Considerations

### 1. **Message Limit**
Pentru a evita memory leaks, se poate adăuga limit:

```javascript
setMessages(prev => [...prev, newMessage].slice(-100)); // Max 100
```

### 2. **Debounce Scroll**
Pentru scroll performant la volume mari:

```javascript
import { debounce } from 'lodash';

const debouncedScroll = debounce(scrollToBottom, 100);
```

### 3. **Virtual Scrolling**
Pentru liste foarte lungi, consideră `react-window` sau `react-virtualized`.

---

## Extensii Viitoare

- [ ] Salvare istoric mesaje în localStorage
- [ ] Export chat la JSON/CSV
- [ ] Search în mesaje
- [ ] Filter pe tip eveniment
- [ ] Emoji picker
- [ ] File attachments
- [ ] Typing indicator
- [ ] Read receipts
- [ ] Message edit/delete
- [ ] Threading (răspunsuri la mesaje)

---

**Versiune documentație:** 1.0  
**Data:** 06 Februarie 2026  
**Status:** ✅ Implementat complet
