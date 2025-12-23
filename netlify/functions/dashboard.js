/**
 * Netlify Function: Dashboard Statistiken
 * GET: Statistiken für das Dashboard berechnen
 */

const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const NOTION_DB_ID = process.env.NOTION_DATABASE_ID;

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const response = await notion.databases.query({
      database_id: NOTION_DB_ID
    });

    const gutachten = response.results;
    
    const statusVerteilung = {
      offen: 0,
      inBearbeitung: 0,
      abgeschlossen: 0,
      verrechnet: 0,
      bezahlt: 0
    };

    let gesamtStunden = 0;
    let gesamtUmsatz = 0;
    let bezahlterUmsatz = 0;

    gutachten.forEach(page => {
      const status = page.properties['Status']?.select?.name || 'Offen';
      const stunden = page.properties['Stunden']?.number || 0;
      const stundensatz = page.properties['Stundensatz']?.number || 0;
      const bezahlt = page.properties['Bezahlt']?.checkbox || false;
      const umsatz = stunden * stundensatz;

      gesamtStunden += stunden;
      gesamtUmsatz += umsatz;
      if (bezahlt) bezahlterUmsatz += umsatz;

      switch (status) {
        case 'Offen': statusVerteilung.offen++; break;
        case 'In Bearbeitung': statusVerteilung.inBearbeitung++; break;
        case 'Abgeschlossen': statusVerteilung.abgeschlossen++; break;
        case 'Verrechnet': statusVerteilung.verrechnet++; break;
        case 'Bezahlt': statusVerteilung.bezahlt++; break;
      }
    });

    const stats = {
      totalAuftraege: gutachten.length,
      offeneAuftraege: statusVerteilung.offen + statusVerteilung.inBearbeitung,
      abgeschlosseneAuftraege: statusVerteilung.abgeschlossen + statusVerteilung.verrechnet + statusVerteilung.bezahlt,
      gesamtStunden,
      gesamtUmsatz,
      bezahlterUmsatz,
      offenerUmsatz: gesamtUmsatz - bezahlterUmsatz,
      statusVerteilung
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, stats })
    };

  } catch (error) {
    console.error('Dashboard Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
