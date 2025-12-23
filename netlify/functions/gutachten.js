/**
 * Netlify Function: Gutachten API
 * GET: Alle Gutachten laden
 * POST: Neues Gutachten erstellen
 */

const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const NOTION_DB_ID = process.env.NOTION_DATABASE_ID;

exports.handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS Request (CORS Preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // GET: Alle Gutachten laden
    if (event.httpMethod === 'GET') {
      const response = await notion.databases.query({
        database_id: NOTION_DB_ID,
        sorts: [{ property: 'Datum', direction: 'descending' }]
      });

      const gutachten = response.results.map(page => ({
        id: page.id,
        gutachtenNr: page.properties['Gutachten-Nr']?.title?.[0]?.plain_text || '',
        kunde: page.properties['Kunde']?.rich_text?.[0]?.plain_text || '',
        datum: page.properties['Datum']?.date?.start || '',
        status: page.properties['Status']?.select?.name || 'Offen',
        stunden: page.properties['Stunden']?.number || 0,
        stundensatz: page.properties['Stundensatz']?.number || 0,
        umsatz: (page.properties['Stunden']?.number || 0) * (page.properties['Stundensatz']?.number || 0),
        beschreibung: page.properties['Beschreibung']?.rich_text?.[0]?.plain_text || '',
        bezahlt: page.properties['Bezahlt']?.checkbox || false,
        url: page.url
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, gutachten })
      };
    }

    // POST: Neues Gutachten erstellen
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);
      const { gutachtenNr, kunde, status, stunden, stundensatz, beschreibung, fotoUrl } = data;

      const properties = {
        'Gutachten-Nr': { title: [{ text: { content: gutachtenNr || `GA-${Date.now()}` } }] },
        'Kunde': { rich_text: [{ text: { content: kunde || '' } }] },
        'Datum': { date: { start: new Date().toISOString().split('T')[0] } },
        'Status': { select: { name: status || 'Offen' } },
        'Stunden': { number: parseFloat(stunden) || 0 },
        'Stundensatz': { number: parseFloat(stundensatz) || 120 },
        'Beschreibung': { rich_text: [{ text: { content: (beschreibung || '').substring(0, 2000) } }] },
        'Bezahlt': { checkbox: false }
      };

      // Foto-URL hinzufügen wenn vorhanden
      if (fotoUrl) {
        properties['Fotos'] = {
          files: [{
            type: 'external',
            name: `${gutachtenNr || 'foto'}.jpg`,
            external: { url: fotoUrl }
          }]
        };
      }

      const response = await notion.pages.create({
        parent: { database_id: NOTION_DB_ID },
        properties
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, id: response.id, url: response.url })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Gutachten Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
