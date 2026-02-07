# Clarificare: Flux Criptare pentru Publicarea Mesajelor Webhook

**Data:** 2026-02-06  
**Issue:** Confuzie despre ce cheie să folosim pentru criptare la publicarea mesajelor

---

## ❌ Înțelegere Inițială Incorectă

**Presupunere greșită:** Client trebuie să cripteze cu propria sa `privateKey`.

**Problemă:**
- În RSA, nu există "criptare cu cheia privată" în sensul tradițional
- Ceea ce se poate face este **semnare digitală** (sign), nu criptare
- Endpoint-ul `/encrypt` din wh-svc-security acceptă doar `publicKey`, nu `privateKey`

---

## ✅ Fluxul Corect Conform Arhitecturii

### Etapa 1: Publisher → Manager

**Client A publică mesaj:**

```javascript
// Payload original
{
  eventId: "uuid",
  message: "Conținutul mesajului"
}
```

**Criptare:**
- **Cheie folosită:** `serverPublicKey` (cheia publică a sistemului dedicată Client A)
- **De ce:** Aceasta garantează că doar managerul (care deține `systemPrivateKey`) poate decripta
- **Implementare:** `securityService.encrypt(payload)` → folosește `serverPublicKey` din `client-config.json`

**Manager decriptează:**
- **Cheie folosită:** `systemPrivateKey` al Client A (din DB/Redis)
- **Cod Java:** `securityService.decrypt(encryptedData, clientPublicKey)` 

**Notă:** În implementarea curentă a `MessageDeliveryService.java`:
```java
decryptedJson = securityService.decrypt(
    command.encryptedData(), 
    publisher.getClientPublicKey()  // ← Aceasta este GREȘITĂ
);
```

**Ar trebui să fie:**
```java
decryptedJson = securityService.decrypt(
    command.encryptedData(), 
    publisher.getSystemPrivateKey()  // ← CORECT - cheia privată a sistemului pentru acest client
);
```

---

### Etapa 2: Manager → Subscribers

**Manager procesează și distribuie:**

```javascript
// Payload pentru subscriber
{
  eventId: "uuid",
  eventName: "order.created",
  sender: "client-a-uuid",
  message: "Conținutul mesajului"
}
```

**Criptare:**
- **Cheie folosită:** `publicKey` al Client B (cheia publică a subscriber-ului)
- **De ce:** Doar Client B (care deține `privateKey`) poate decripta
- **Cod Java:** `securityService.encrypt(payload, subscriberPublicKey)`

**Client B decriptează:**
- **Cheie folosită:** `privateKey` din `client-config.json`
- **Cod Node.js:** `securityService.decrypt(encryptedData)` → folosește `privateKey` local

---

## 🔐 Rezumat Chei Folosite

| Etapă | Actor | Operație | Cheie Folosită | Sursa Cheii |
|-------|-------|----------|----------------|-------------|
| 1 | Client A (Publisher) | **ENCRYPT** | `serverPublicKey` | `client-config.json` |
| 2 | Manager | **DECRYPT** | `systemPrivateKey` Client A | DB/Redis |
| 3 | Manager | **ENCRYPT** | `publicKey` Client B | DB/Redis |
| 4 | Client B (Subscriber) | **DECRYPT** | `privateKey` | `client-config.json` |

---

## 🔧 Fix Necesar în MessageDeliveryService.java

**Fișier:** `wh-svc-manager/src/main/java/com/managerwebhooks/application/service/MessageDeliveryService.java`

**Linia ~53 (aproximativ):**

**ÎNAINTE (GREȘIT):**
```java
decryptedJson = securityService.decrypt(
        command.encryptedData(), 
        publisher.getClientPublicKey()  // ❌ GREȘIT
);
```

**DUPĂ (CORECT):**
```java
decryptedJson = securityService.decrypt(
        command.encryptedData(), 
        publisher.getSystemPrivateKey()  // ✅ CORECT
);
```

**Explicație:**
- Clientul a criptat cu `serverPublicKey` (=`systemPublicKey`)
- Pentru decriptare, Manager-ul trebuie să folosească perechea: `systemPrivateKey`
- `clientPublicKey` este cheia publică a CLIENTULUI, nu a sistemului

---

## 📝 Arquitectura Cheilor în Sistem

Fiecare client are **4 chei**:

### 1. `clientPublicKey` (Client's Own Public Key)
- **Proprietar:** Clientul
- **Generată de:** Client la enrollment
- **Stocată în:** DB Manager + `client-config.json` (opțional)
- **Folosită pentru:** NU este folosită în fluxul curent

### 2. `clientPrivateKey` (Client's Own Private Key)  
- **Proprietar:** Clientul (SECRET!)
- **Generată de:** Client la enrollment
- **Stocată în:** `client-config.json` (doar local)
- **Folosită pentru:** Decriptare mesaje primite de la subscriberi

### 3. `systemPublicKey` (Server's Public Key for THIS Client)
- **Proprietar:** Sistemul (Manager)
- **Generată de:** Manager la enrollment
- **Stocată în:** DB Manager
- **Trimisă clientului ca:** `serverPublicKey` în `client-config.json`
- **Folosită pentru:** **Client criptează mesajele sale** către Manager

### 4. `systemPrivateKey` (Server's Private Key for THIS Client)
- **Proprietar:** Sistemul (Manager) - SECRET!
- **Generată de:** Manager la enrollment
- **Stocată în:** DB Manager (NU se trimite clientului)
- **Folosită pentru:** **Manager decriptează mesajele** de la acest client

---

## ✅ Implementare Corectă în wh-client-backend

**Fișier:** `controllers/gatewayController.js`

```javascript
// Criptează payload-ul cu serverPublicKey (cheia publică a sistemului dedicată acestui client)
// Manager va decripta cu systemPrivateKey al clientului (din DB)
const encryptedData = await securityService.encrypt(JSON.stringify(payload));
```

**Metodă folosită:** `securityService.encrypt()`
- Folosește automat `serverPublicKey` din `client-config.json`
- **CORECT** ✅

---

## 🎯 Concluzie

**Fluxul corect de criptare:**

1. **Client → Manager:** 
   - Criptare cu `serverPublicKey` (cheia publică a sistemului)
   - Decriptare cu `systemPrivateKey` (cheia privată a sistemului pentru acest client)

2. **Manager → Subscriber:**
   - Criptare cu `publicKey` subscriber (cheia publică a destinatarului)
   - Decriptare cu `privateKey` subscriber (cheia privată a destinatarului)

**Metoda `encryptWithPrivateKey` creată nu este necesară și NU trebuie folosită.**

---

**Status:** ✅ Clarificare completă  
**Action Items:**
1. ✅ Revert la `securityService.encrypt()` în controller (DONE)
2. ⚠️ **FIX NECESAR în Java:** Schimbă `getClientPublicKey()` cu `getSystemPrivateKey()` în `MessageDeliveryService.java`

---

**Autor:** GitHub Copilot  
**Data:** 2026-02-06
