# SV Gutachten Schweißtechnik v10.0 - Netlify Edition

Schweißnaht-Prüfsoftware mit Claude Vision KI-Analyse, optimiert für Netlify Deployment.

## Quick Deploy

### Option 1: Netlify CLI (empfohlen)

```bash
# 1. Dependencies installieren
npm install

# 2. Bei Netlify einloggen
npx netlify login

# 3. Neues Projekt erstellen
npx netlify init

# 4. API Key setzen
npx netlify env:set ANTHROPIC_API_KEY sk-ant-api03-dein-key

# 5. Deployen
npx netlify deploy --prod
```

### Option 2: Git-basiertes Deployment

1. Repository auf GitHub/GitLab pushen
2. In Netlify: "Add new site" → "Import an existing project"
3. Repository verbinden
4. Build settings:
   - Build command: (leer lassen)
   - Publish directory: `public`
5. Environment Variables setzen:
   - `ANTHROPIC_API_KEY` = dein Claude API Key
6. Deploy!

## Lokale Entwicklung

```bash
npm install
npx netlify dev
# Öffne http://localhost:8888
```

## Projektstruktur

```
schweissapp-v10-netlify/
├── netlify.toml           # Netlify Konfiguration
├── netlify/functions/
│   └── api.mts            # Serverless Function (Backend)
├── public/
│   └── index.html         # React Frontend
├── package.json
└── README.md
```

## Features

- 🤖 Claude Vision KI-Analyse (Multi-Bild)
- 📋 TÜV-konforme Grenzwerte nach ISO 15614-1
- 📄 DOCX-Export für Prüfgutachten
- 💰 GebAG-Kalkulator (§34/35/36)
- 📖 Fehlerkatalog nach ISO 6520-1

## Normen

- ISO 15614-1: WPQR-Anforderungen
- ISO 5817: Bewertungsgruppen B/C/D
- ISO 17637: Sichtprüfung
- ISO 6520-1: Fehlerkatalog
