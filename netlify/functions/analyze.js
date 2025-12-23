/**
 * Netlify Function: Claude Vision Bildanalyse
 * POST: Schweißnaht-Bilder analysieren (bis zu 4 Bilder)
 * 
 * Erwartet: multipart/form-data mit 'images' Feld
 * Oder: JSON mit base64-kodierten Bildern
 */

const Anthropic = require('@anthropic-ai/sdk');
const Busboy = require('busboy');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Multipart Form Parser
const parseMultipartForm = (event) => {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: {
        'content-type': event.headers['content-type'] || event.headers['Content-Type']
      }
    });

    const files = [];

    busboy.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;
      const chunks = [];

      file.on('data', (chunk) => chunks.push(chunk));
      file.on('end', () => {
        files.push({
          fieldname,
          filename,
          mimetype: mimeType,
          buffer: Buffer.concat(chunks)
        });
      });
    });

    busboy.on('finish', () => resolve(files));
    busboy.on('error', reject);

    // Body dekodieren (Netlify sendet base64)
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body);

    busboy.end(body);
  });
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    let imageContents = [];
    let imageCount = 0;

    // Content-Type prüfen
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';

    if (contentType.includes('multipart/form-data')) {
      // Multipart Form Data parsen
      const files = await parseMultipartForm(event);
      
      if (!files || files.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Keine Bilder hochgeladen' })
        };
      }

      imageCount = files.length;
      imageContents = files.map(file => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: file.mimetype,
          data: file.buffer.toString('base64')
        }
      }));

    } else if (contentType.includes('application/json')) {
      // JSON mit base64 Bildern
      const data = JSON.parse(event.body);
      
      if (!data.images || data.images.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Keine Bilder im Request' })
        };
      }

      imageCount = data.images.length;
      imageContents = data.images.map(img => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mediaType || 'image/jpeg',
          data: img.data
        }
      }));
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Ungültiger Content-Type' })
      };
    }

    const imageLabels = ['Draufsicht', 'Wurzelseite', 'Seitenansicht', 'Detailaufnahme'];
    const imageDescriptions = imageContents.map((_, i) => imageLabels[i] || `Bild ${i+1}`).join(', ');

    const systemPrompt = `Du bist ein erfahrener Schweißfachingenieur und Sachverständiger für Schweißtechnik.
Analysiere die ${imageCount} Bilder der Schweißnaht nach ISO 5817 und ISO 17637.
Die Bilder zeigen verschiedene Perspektiven: ${imageDescriptions}.

Berücksichtige alle Bilder für eine umfassende Beurteilung:
- Draufsicht: Nahtbreite, Schuppenbildung, Spritzer, Oberflächenqualität
- Wurzelseite: Durchschweißung, Wurzelfehler, Wurzelüberhöhung
- Seitenansicht: Nahtüberhöhung, Einbrandkerben, Nahtgeometrie
- Detailaufnahme: Poren, Risse, Oberflächenfehler

Strukturiere deine Analyse in drei Abschnitte:

## ANAMNESE
- Nahttyp identifizieren (BW, FW, etc.)
- Schweißposition schätzen
- Werkstoff wenn erkennbar
- Oberflächenzustand aus allen Perspektiven beschreiben
- Sichtbare Befunde aus jedem Bild auflisten
- Maße schätzen (Nahtbreite, Überhöhung, Durchschweißung, etc.)

## DIAGNOSE
- Hauptbefund formulieren (alle Perspektiven berücksichtigen)
- Bewertungsgruppe nach ISO 5817 (B, C, D)
- Normkonformität bewerten
- Ursachenanalyse bei Fehlern
- Kritikalität einschätzen

## CONCLUSIO
- Ergebnis: BESTANDEN / NACHARBEIT ERFORDERLICH / ABGELEHNT
- Empfehlung formulieren
- Erforderliche Maßnahmen auflisten
- Weitere ZfP-Empfehlungen (PT, MT, UT, RT falls nötig)
- Priorität angeben

Sei präzise und fachlich korrekt. Verwende die korrekte schweißtechnische Terminologie.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContents,
            {
              type: 'text',
              text: `Bitte analysiere diese ${imageCount} Bilder der Schweißnaht gemäß ISO 5817 und ISO 17637. 
Die Bilder zeigen: ${imageDescriptions}.
Führe eine vollständige Sichtprüfung (VT) durch und berücksichtige alle Perspektiven für eine umfassende Beurteilung.`
            }
          ]
        }
      ],
      system: systemPrompt
    });

    const analysisText = response.content[0].text;

    // Ergebnis parsen
    const getSection = (text, section) => {
      const regex = new RegExp(`## ${section}\\s*([\\s\\S]*?)(?=## |$)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : '';
    };

    const anamnese = getSection(analysisText, 'ANAMNESE');
    const diagnose = getSection(analysisText, 'DIAGNOSE');
    const conclusio = getSection(analysisText, 'CONCLUSIO');

    // Status ableiten
    let status = 'Bestanden';
    if (conclusio.toLowerCase().includes('abgelehnt')) status = 'Abgelehnt';
    else if (conclusio.toLowerCase().includes('nacharbeit')) status = 'Nacharbeit';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        analysis: {
          anamnese,
          diagnose,
          conclusio,
          status,
          fullText: analysisText
        }
      })
    };

  } catch (error) {
    console.error('Claude Vision Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
