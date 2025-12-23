/**
 * Netlify Function: Health Check
 * GET: API Status prüfen
 */

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

  // Prüfen welche Environment Variables gesetzt sind
  const notion = !!process.env.NOTION_TOKEN && !!process.env.NOTION_DATABASE_ID;
  const anthropic = !!process.env.ANTHROPIC_API_KEY;
  const cloudinary = !!process.env.CLOUDINARY_CLOUD_NAME && 
                     !!process.env.CLOUDINARY_API_KEY && 
                     !!process.env.CLOUDINARY_API_SECRET;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      status: 'ok',
      version: '8.1.0',
      platform: 'netlify',
      notion,
      anthropic,
      cloudinary,
      timestamp: new Date().toISOString()
    })
  };
};
