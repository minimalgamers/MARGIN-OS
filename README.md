# MARGIN OS — Minimal Gamers

ERP interno per analisi profittabilità ordine per ordine.

---

## DEPLOY: Guida Passo-Passo

### PASSO 1 — Crea account (se non li hai già)

1. **GitHub**: vai su https://github.com → Sign up
2. **Vercel**: vai su https://vercel.com → Sign up con GitHub
3. Fatto. Non serve altro.

---

### PASSO 2 — Crea la Custom App su Shopify

Questo ti dà il "token" per leggere gli ordini.

1. Vai su **minimalgamers.myshopify.com/admin**
2. In basso a sinistra → **Settings** (⚙️)
3. Clicca **Apps and sales channels**
4. Clicca **Develop apps** (in alto a destra)
5. Se è la prima volta: clicca **"Allow custom app development"** → conferma
6. Clicca **"Create an app"**
7. Nome: **Margin OS** → clicca **Create app**
8. Vai nel tab **"Configuration"**
9. Clicca **"Configure"** accanto a "Admin API integration"
10. Cerca e spunta SOLO:
    - ✅ `read_orders`
    - ✅ `read_products`
11. Clicca **Save**
12. Vai nel tab **"API credentials"**
13. Clicca **"Install app"** → conferma
14. **COPIA il token** (Admin API access token) — **LO VEDI UNA SOLA VOLTA!**

📝 Salva: `shpat_xxxxxxxxxxxxxxxxxxxxx`

---

### PASSO 3 — Carica il codice su GitHub

1. Vai su https://github.com
2. Clicca **+** → **New repository**
3. Nome: **margin-os**
4. Visibilità: **Private** ⚠️
5. Clicca **Create repository**
6. Nella pagina del repo, clicca **"uploading an existing file"**
7. Trascina TUTTI questi file/cartelle:
   ```
   margin-os/
   ├── api/
   │   ├── orders.js
   │   └── health.js
   ├── public/
   │   ├── index.html
   │   └── app.jsx
   ├── package.json
   └── vercel.json
   ```
8. Clicca **"Commit changes"**

---

### PASSO 4 — Deploy su Vercel

1. Vai su https://vercel.com/dashboard
2. Clicca **"Add New" → "Project"**
3. Trova **margin-os** nella lista → clicca **"Import"**
4. **PRIMA DI FARE DEPLOY** → clicca **"Environment Variables"**
5. Aggiungi queste 3 variabili:

| Name | Value |
|------|-------|
| `SHOPIFY_ACCESS_TOKEN` | `shpat_xxx...` (il token del passo 2) |
| `SHOPIFY_SHOP_DOMAIN` | `minimalgamers.myshopify.com` |
| `APP_PASSWORD` | Una password a tua scelta (es: `MG2026!secure`) |

6. Clicca **"Deploy"**
7. Attendi 1-2 minuti
8. Vercel ti dà un URL tipo: **`margin-os-xxx.vercel.app`**

---

### PASSO 5 — Primo accesso

1. Apri l'URL nel browser
2. Dovresti vedere Margin OS vuoto (zero ordini)
3. Vai su **Sincronizza** → clicca **"⟳ Sincronizza Ordini"**
4. Se chiede la password, aprilo in console del browser (F12) e scrivi:
   ```
   localStorage.setItem("mg-pwd", "LA_TUA_PASSWORD")
   ```
   Poi ricarica e riprova.
5. Gli ordini dovrebbero caricarsi da Shopify!

---

### PASSO 6 — Aggiungi alla Home del telefono

**iPhone:**
1. Apri l'URL in Safari
2. Tocca l'icona Condividi (quadrato con freccia ↑)
3. Tocca **"Aggiungi alla schermata Home"**
4. Nome: **Margin OS** → Aggiungi

**Android:**
1. Apri l'URL in Chrome
2. Tocca i 3 puntini ⋮ in alto a destra
3. Tocca **"Aggiungi a schermata Home"**

---

## FAQ

**Gli ordini si aggiornano da soli?**
No, devi premere "Sincronizza" manualmente. In futuro possiamo aggiungere un webhook per il real-time.

**Se cambio un costo nel database, devo rifare il deploy?**
No. Il database è nel browser (localStorage). Modifichi e basta.

**Se aggiorno il codice su GitHub?**
Vercel fa il re-deploy automatico. I dati nel browser restano.

**Posso usare ancora il CSV?**
Sì, c'è il bottone "Import CSV (backup)" nella pagina Sincronizza.

**Quanto costa?**
€0. Vercel Free + Shopify API inclusa nel tuo piano.
