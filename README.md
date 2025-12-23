# SchweißApp v8.1 - Vollständige Netlify Version

## 🎯 Was ist das?

Eine **komplett eigenständige** Version der SchweißApp, die auf Netlify läuft - unabhängig von Replit.

- ✅ Nutzt dieselbe Notion-Datenbank (deine Testgutachten sind da!)
- ✅ Claude Vision für Bildanalyse
- ✅ Cloudinary für Fotospeicherung
- ✅ Serverless Functions (kein Server nötig)

---

## 🚀 Deployment in 10 Minuten

### Schritt 1: GitHub Repository erstellen

1. Gehe zu https://github.com/new
2. Repository Name: `schweissapp-netlify`
3. **Public** auswählen
4. Klick "Create repository"

### Schritt 2: Dateien hochladen

1. Auf der leeren Repo-Seite: Klick "uploading an existing file"
2. **Entpacke dieses ZIP** auf deinem Computer
3. Ziehe ALLE Dateien und Ordner in das GitHub Upload-Feld:
   - `public/` (Ordner)
   - `netlify/` (Ordner)
   - `netlify.toml`
   - `package.json`
   - `README.md`
4. Commit message: "Initial commit"
5. Klick "Commit changes"

### Schritt 3: Netlify mit GitHub verbinden

1. Gehe zu https://app.netlify.com
2. "Add new site" → "Import an existing project"
3. "Deploy with GitHub" auswählen
4. GitHub authorisieren (falls noch nicht)
5. Repository `schweissapp-netlify` auswählen
6. Build settings:
   - **Build command:** (LEER lassen!)
   - **Publish directory:** `public`
7. Klick "Deploy site"

### Schritt 4: Environment Variables setzen ⚠️ WICHTIG!

1. Nach dem ersten Deploy: "Site configuration" → "Environment variables"
2. Klick "Add a variable" für JEDE dieser Variablen:

| Key | Value |
|-----|-------|
| `NOTION_TOKEN` | `secret_...` (dein Notion Token) |
| `NOTION_DATABASE_ID` | `97890bb87f31401d893d76458a4707c3` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` (dein Claude Key) |
| `CLOUDINARY_CLOUD_NAME` | `diigs5gvr` |
| `CLOUDINARY_API_KEY` | `226671299266424` |
| `CLOUDINARY_API_SECRET` | `...` (dein Cloudinary Secret) |

### Schritt 5: Neu deployen

1. Gehe zu "Deploys" Tab
2. Klick "Trigger deploy" → "Deploy site"
3. Warte 1-2 Minuten

### Schritt 6: Fertig! 🎉

Deine App läuft unter: `https://DEIN-SITE-NAME.netlify.app`

---

## 📁 Projektstruktur

```
schweissapp-netlify/
├── public/
│   └── index.html          # Frontend (React)
├── netlify/
│   └── functions/
│       ├── analyze.js      # Claude Vision API
│       ├── gutachten.js    # Notion: Laden & Speichern
│       ├── update-status.js# Status ändern
│       ├── dashboard.js    # Statistiken
│       ├── upload-image.js # Cloudinary Upload
│       └── health.js       # Health Check
├── netlify.toml            # Netlify Config
├── package.json            # Dependencies
└── README.md
```

---

## 🔑 Deine API Keys (aus Replit)

Diese Keys brauchst du - sie sind dieselben wie in Replit:

**Notion:**
- Token: In Replit unter "Secrets" → `NOTION_TOKEN`
- Database ID: `97890bb87f31401d893d76458a4707c3`

**Anthropic (Claude):**
- API Key: In Replit unter "Secrets" → `ANTHROPIC_API_KEY`

**Cloudinary:**
- Cloud Name: `diigs5gvr`
- API Key: `226671299266424`
- API Secret: In Replit unter "Secrets" → `CLOUDINARY_API_SECRET`

---

## ⚠️ Bekannte Limits

**Netlify Free Tier:**
- Function Timeout: 10 Sekunden (kann knapp werden bei Bildanalyse)
- 125.000 Function-Aufrufe/Monat

**Empfehlung für Produktion:** Netlify Pro ($19/Monat) für 26 Sek. Timeout

---

## 🆘 Troubleshooting

**"Function timeout":**
→ Bildanalyse dauert zu lange. Kleinere Bilder verwenden oder Netlify Pro.

**"Keine Gutachten angezeigt":**
→ Environment Variables prüfen! Nach Änderung neu deployen.

**"CORS Error":**
→ Sollte nicht passieren. Falls doch: netlify.toml Headers prüfen.
