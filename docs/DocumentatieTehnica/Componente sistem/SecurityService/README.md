---
id: security-service
slug: /DocumentatieTehnica/SecurityService/security-service
title: Security Service
---

# Security Service

Security Service este responsabil de gestionarea operațiunilor de securitate pentru sistemul Secure WebHooks. Acest serviciu va avea următoarele responsabilități principale:

- Generarea perechilor de chei private/publice necesare pentru criptarea și decriptarea datelor.
- Criptarea și decriptarea informațiilor transmise între componentele sistemului și aplicațiile client.
- Managementul ciclului de viață al cheilor (creare, validare, invalidare, ștergere).
- Asigurarea confidențialității și integrității datelor în tranzit.
- Expunerea unor metode/endpoint-uri pentru alte servicii care au nevoie de operațiuni criptografice.

Security Service nu expune direct endpoint-uri către aplicațiile client, ci oferă funcționalități altor servicii din arhitectură (ex: API Gateway, Webhook Management Service, Event Ingestion Service etc.).

---

## Algoritmi de criptare: RSA vs AES

**RSA (asimetric):**
- Avantaje: Permite comunicare securizată fără partajarea prealabilă a unei chei secrete, suport larg, simplifică integrarea cu clienți diverși, permite semnături digitale.
- Dezavantaje: Mai lent, consumă mai multe resurse, potrivit pentru date mici (chei, token-uri).

**AES (simetric):**
- Avantaje: Extrem de rapid, eficient pentru volume mari de date, performanță ridicată.
- Dezavantaje: Necesită distribuție sigură a cheii secrete, nu oferă semnătură digitală sau schimb de chei.

**Decizie:**
Am adoptat criptare hibridă:
- RSA 2048 OAEP-SHA256 pentru a proteja cheia simetrică + IV (schimb de chei sigur, fără partajare prealabilă).
- AES-256-GCM pentru a cripta payload-urile (performanță bună pe date mari și integritate prin tag GCM).

---

## Funcționalități expuse prin API

Security Service oferă următoarele endpoint-uri REST:

### 1. Generare pereche de chei RSA
- **GET** `/generate-keypair`
- Returnează o pereche de chei (publică și privată) în format Base64.

**Exemplu răspuns:**
```json
{
  "publicKey": "...",
  "privateKey": "..."
}
```

### 2. Criptare mesaj
- **POST** `/encrypt`
- Primește un string și o cheie publică, returnează stringul criptat (Base64).

**Request:**
```json
{
  "data": "Text de criptat",
  "publicKey": "..."
}
```
**Response:**
```json
{
  "encryptedData": "..."
}
```

### 3. Decriptare mesaj
- **POST** `/decrypt`
- Primește un string criptat și o cheie privată, returnează stringul decriptat.

**Request:**
```json
{
  "encryptedData": "...",
  "privateKey": "..."
}
```
**Response:**
```json
{
  "decryptedData": "..."
}
```

### 4. Generare parolă puternică
- **GET** `/generate-password?length=16`
- Generează o parolă puternică cu lungime configurabilă (parametru opțional, default: 16, minim: 8).
- Parola conține obligatoriu: litere mari, litere mici, cifre și caractere speciale.
- Algoritmul folosește SecureRandom pentru generare aleatorie criptografic sigură.

**Exemplu request:**
```bash
curl "http://localhost:8080/generate-password?length=20"
```

**Exemplu response:**
```json
{
  "password": "aB3$xY9!pQ2#mN7&kL5@"
}
```

**Caracteristici:**
- Lungime minimă: 8 caractere
- Lungime default: 16 caractere
- Conține: A-Z, a-z, 0-9, !@#$%^&*()-_=+[]{}|;:,.?
- Parolele sunt randomizate complet (nu au pattern predictibil)

---

## Documentație OpenAPI (Swagger)

Security Service expune documentația sa API în format OpenAPI 3.0, accesibilă prin:

- **Swagger UI (interfață interactivă)**: http://localhost:8080/swagger-ui.html
- **OpenAPI JSON**: http://localhost:8080/v3/api-docs
- **OpenAPI YAML**: http://localhost:8080/v3/api-docs.yaml

### Swagger UI Features
Interfața Swagger UI oferă:
- Documentație completă pentru toate endpoint-urile
- Posibilitate de testare directă din browser (Try it out)
- Specificații detaliate pentru request și response
- Exemple de utilizare pentru fiecare endpoint
- Validare automată a request-urilor

### Utilizare
1. Accesează http://localhost:8080/swagger-ui.html în browser
2. Explorează endpoint-urile disponibile
3. Click pe un endpoint pentru a vedea detalii
4. Folosește "Try it out" pentru a testa direct din browser
5. Completează parametrii necesari și execută request-ul

---

## Algoritm actual de criptare / decriptare

**Abordare:** criptare hibridă (envelope encryption) pentru a suporta payload-uri mari, păstrând contractul unui singur câmp Base64.

- **RSA 2048 OAEP-SHA256 (asimetric, pentru cheie+IV):** Padding modern OAEP cu hash SHA-256; oferă protecție mai bună la atacuri decât PKCS#1 v1.5, max ~190B per bloc pentru 2048 biți, folosit doar pentru a proteja cheia simetrică și IV.
- **AES-256-GCM (simetric, pentru payload):** Criptare rapidă pe blocuri cu tag de integritate GCM (AEAD); folosește cheie de 256 biți și IV de 12 octeți; detectează automat alterarea datelor.
- Format rezultat (un singur string Base64): `[lenRSA(2 bytes)][RSA(key+iv)][AES(ciphertext+tag)]`.
- /encrypt generează o cheie AES aleatoare și IV, criptează datele cu AES-GCM, apoi criptează cheia+IV cu RSA și returnează un singur Base64.
- /decrypt desface formatul: citește lungimea, decriptează cheia+IV cu RSA, apoi decriptează ciphertext-ul cu AES-GCM.
- Beneficii: performanță bună pe date mari, contract stabil (un singur string), rezistență la tampering prin GCM.
---

## Notă de utilizare

- Toate datele și cheile sunt codate Base64.
- Cheile generate sunt de 2048 biți (RSA).
- Pentru mesaje mari se folosește criptarea hibridă RSA + AES-GCM (implementată în /encrypt și /decrypt).
- Endpoint-urile pot fi consumate atât de alte servicii interne, cât și pentru testare manuală (curl, Postman etc).
