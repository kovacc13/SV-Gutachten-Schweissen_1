# SV Gutachten Schweißtechnik v10.1 Premium Edition

## 🔥 Features

- **Claude Vision KI-Analyse** - Automatische Schweißnaht-Analyse nach ISO 5817
- **Multi-Image Upload** - Bis zu 4 Bilder gleichzeitig analysieren
- **Notion Integration** - Alle Gutachten automatisch in Notion speichern (ALLE Bilder!)
- **Cloudinary Storage** - Sichere Bild-Speicherung in der Cloud
- **DOCX Export** - Professionelle Gutachten als Word-Dokument
- **Premium Design** - Glassmorphism Dark Mode UI
- **ISO-konform** - ISO 15614-1, ISO 5817, ISO 6520-1

## 🚀 Deployment auf Netlify

### 1. Repository erstellen

```bash
git init
git add .
git commit -m "v10.1 Premium Edition"
git remote add origin https://github.com/DEIN-USERNAME/sv-gutachten.git
git push -u origin main
```

### 2. Netlify verbinden

1. Gehe zu [netlify.com](https://netlify.com)
2. "Add new site" → "Import an existing project"
3. Wähle dein GitHub Repository
4. Build settings:
   - **Build command**: (leer lassen)
   - **Publish directory**: `public`

### 3. Environment Variables setzen

In Netlify Dashboard → Site settings → Environment variables:

| Variable | Wert |
|----------|------|
| `ANTHROPIC_API_KEY` | Dein Claude API Key |
| `NOTION_API_KEY` | Dein Notion Integration Token |
| `CLOUDINARY_API_SECRET` | `2jBI54VSyu2rY-Ej7OaRIv3lBUE` |

### 4. Notion Integration einrichten

1. Gehe zu [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Erstelle eine neue Integration
3. Kopiere den "Internal Integration Token"
4. Öffne deine Notion-Datenbank
5. Klicke oben rechts auf "..." → "Connections" → Deine Integration hinzufügen

## 📊 Notion Datenbank-Schema

Die Datenbank sollte folgende Properties haben:

| Property | Typ |
|----------|-----|
| Auftragsnummer | Title |
| Prüfgegenstand | Rich Text |
| Auftraggeber | Rich Text |
| Werkstoff | Select |
| Bewertungsgruppe | Select (B, C, D) |
| Wanddicke | Number |
| Fotos | Files |
| Beschreibung | Rich Text |
| Status | Select (Bestanden, Nacharbeit, Nicht bestanden, Offen) |
| Prüfdatum | Date |

## 🔧 Lokale Entwicklung

```bash
npm install
netlify dev
```

Öffne http://localhost:8888

## 📝 Änderungshistorie

### v10.1 Premium Edition
- ✅ Multi-Image Notion Upload (alle Bilder werden gespeichert!)
- ✅ Cloudinary Integration serverseitig (sicher)
- ✅ max_tokens auf 8192 erhöht (keine Text-Kürzung mehr)
- ✅ DOCX Library von unpkg.com (stabiler)
- ✅ Premium Glassmorphism Design
- ✅ Verbesserte Status-Anzeigen (Vision, Notion, Cloudinary)

### v10.0 TÜV-Edition
- Claude Vision API Integration
- ISO 15614-1 Compliance
- Express zu Netlify Functions Migration

## 🔒 Sicherheit

- Cloudinary API Secret wird nur serverseitig verwendet
- Notion API Key wird nur serverseitig verwendet
- Keine sensiblen Daten im Frontend

## 📞 Support

Bei Fragen oder Problemen: GitHub Issues erstellen
