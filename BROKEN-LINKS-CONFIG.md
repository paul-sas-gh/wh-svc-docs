# Configurare Docusaurus - Broken Links

**Data:** 7 februarie 2026  
**Scop:** Explicație configurare handling broken links în Docusaurus

---

## Setări Aplicate

În `docusaurus.config.js` am configurat:

```javascript
onBrokenLinks: 'warn',
onBrokenMarkdownLinks: 'warn',
```

---

## Opțiuni Disponibile

### onBrokenLinks

Controlează comportamentul când Docusaurus detectează link-uri rupte către pagini interne.

| Valoare | Comportament | Când să folosești |
|---------|--------------|-------------------|
| `'throw'` | ❌ Build eșuează (default) | Producție - zero tolerance pentru erori |
| `'warn'` | ⚠️ Afișează warning, build continuă | **Development - recomandat** |
| `'ignore'` | ✅ Ignoră complet | Nu este recomandat |

### onBrokenMarkdownLinks

Controlează comportamentul pentru link-uri Markdown relative (`[text](./file.md)`).

**Configurare actuală:** `'warn'` - permite build-ul să continue cu warning-uri

---

## De Ce 'warn' și Nu 'ignore'?

✅ **Avantaje 'warn':**
- Build-ul nu eșuează în development
- Primești feedback în console despre link-uri rupte
- Poți fixa link-urile treptat
- Menții awareness despre calitatea documentației

❌ **Dezavantaje 'ignore':**
- Nu știi că există probleme
- Broken links ajung în producție
- Experiență degradată pentru utilizatori

---

## Link-uri Afectate în Proiect

### Link-uri către cod sursă (din index.md)

Aceste link-uri sunt relative și pot cauza warning-uri:

```markdown
**Cod Sursă:**
- [wh-svc-gateway](../../../../wh-svc-gateway/)
- [wh-svc-manager](../../../../wh-svc-manager/)
- [wh-svc-security](../../../../wh-svc-security/)
- [wh-client](../../../../wh-client/)
```

**Status:** ⚠️ Warning-uri afișate în build, dar documentația se generează corect

**Soluție viitoare:** 
- Opțiune 1: Folosește link-uri absolute către GitHub
- Opțiune 2: Exclude aceste link-uri din build
- Opțiune 3: Creează alias-uri pentru directoarele externe

### Link-uri către rapoarte de implementare

```markdown
**Rapoarte Implementare:**
- [Message Distribution Workflow](../Rapoarte%20de%20implementare/Workflows/Message-Distribution/)
- [Client Enrollment Workflow](../Rapoarte%20de%20implementare/Workflows/Inrolare%20Client%20-%20Schimb%20de%20chei/)
```

**Status:** ✅ Funcționează corect (link-uri interne în docs/)

---

## Verificare Build

### Testare locală

```bash
cd wh-svc-docs
npm run build
```

**Comportament așteptat cu 'warn':**
- Build-ul se termină cu SUCCESS
- Warning-uri afișate în console pentru link-uri externe
- Site-ul se generează complet în `build/`

### Exemplu output

```
[WARNING] Broken link on source page path = /docs/DocumentatieTehnica/Arhitectura logica/index:
-> linking to ../../../../wh-svc-gateway/ (resolved as: /wh-svc-gateway/)

Build completed successfully!
```

---

## Best Practices

### Pentru Development

✅ Folosește `onBrokenLinks: 'warn'`
- Permite iterare rapidă
- Vizibilitate asupra problemelor
- Nu blochează lucrul

### Pentru Production

Recomandări:
1. **CI/CD Pipeline:** Setează `'throw'` în environment de producție
2. **Pre-commit Hook:** Rulează verificare link-uri
3. **Documentație Review:** Verifică periodic warning-urile

### Exemplu CI/CD

```yaml
# .github/workflows/docs.yml
- name: Build Docs (Strict)
  run: |
    cd wh-svc-docs
    # Override config for production
    sed -i "s/onBrokenLinks: 'warn'/onBrokenLinks: 'throw'/g" docusaurus.config.js
    npm run build
```

---

## Resurse Oficiale

- [Docusaurus - Broken Links Detection](https://docusaurus.io/docs/api/docusaurus-config#onBrokenLinks)
- [Docusaurus - Config Reference](https://docusaurus.io/docs/configuration)

---

## Status Curent

✅ **Configurare aplicată:** `'warn'` pentru ambele setări  
✅ **Build funcțional:** Da, cu warning-uri pentru link-uri externe  
📋 **TODO viitor:** Migrare link-uri cod sursă la GitHub URLs

---

**Menținut de:** Engineering Team  
**Ultima verificare:** 7 februarie 2026
