import Anthropic from "@anthropic-ai/sdk";
import { Context } from "@netlify/functions";
import { v2 as cloudinary } from "cloudinary";

// Cloudinary Konfiguration
cloudinary.config({
  cloud_name: "diigs5gvr",
  api_key: "226671299266424",
  api_secret: process.env.CLOUDINARY_API_SECRET || "2jBI54VSyu2rY-Ej7OaRIv3lBUE",
  secure: true,
});

// Notion API Konfiguration
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = "e8645c64b5bd419ea240bb89de67071e"; // Prüfaufträge Schweißtechnik

// CORS Headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Grenzwerte nach ISO 15614-1
const GRENZWERTE = {
  haerte: {
    "1.1": { max: 380 },
    "1.2": { max: 380 },
    "2": { max: 450 },
    "3": { max: 450 },
    "8.1": { max: null },
    "10": { max: 350 },
  },
  zugfestigkeit: {
    S235: { min: 360 },
    S275: { min: 410 },
    S355: { min: 470 },
    "S355J2+N": { min: 470 },
    S460: { min: 540 },
    S690: { min: 770 },
    "1.4301": { min: 520 },
    "1.4571": { min: 520 },
    "1.4462": { min: 640 },
  },
};

const WERKSTOFFGRUPPEN: Record<string, string> = {
  S235: "1.1",
  S275: "1.1",
  S355: "1.2",
  "S355J2+N": "1.2",
  S460: "2",
  S690: "3",
  "1.4301": "8.1",
  "1.4571": "8.1",
  "1.4462": "10",
};

// Helper: Parse multipart form data
async function parseMultipartFormData(
  request: Request
): Promise<{ fields: Record<string, string>; files: File[] }> {
  const formData = await request.formData();
  const fields: Record<string, string> = {};
  const files: File[] = [];

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      files.push(value);
    } else {
      fields[key] = value;
    }
  }

  return { fields, files };
}

// Helper: File zu Base64
async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

// Helper: Upload zu Cloudinary
async function uploadToCloudinary(file: File): Promise<string> {
  const base64Data = await fileToBase64(file);
  const dataUri = `data:${file.type};base64,${base64Data}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "schweissapp-gutachten",
    resource_type: "image",
  });

  return result.secure_url;
}

// Helper: Speichere in Notion
async function saveToNotion(data: {
  auftragsnummer: string;
  pruefgegenstand: string;
  auftraggeber: string;
  werkstoff: string;
  bewertungsgruppe: string;
  wanddicke: string;
  anamnese: string;
  diagnose: string;
  conclusio: string;
  status: string;
  fotoUrls: string[];
}): Promise<{ success: boolean; pageId?: string; url?: string; error?: string }> {
  if (!NOTION_API_KEY) {
    return { success: false, error: "NOTION_API_KEY nicht konfiguriert" };
  }

  try {
    // Notion Files Property erwartet ein Array von External File Objects
    const filesProperty = data.fotoUrls.map((url, index) => ({
      type: "external",
      name: `Foto ${index + 1}`,
      external: { url },
    }));

    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties: {
          // Titel-Property (Name der Spalte könnte variieren)
          Auftragsnummer: {
            title: [{ text: { content: data.auftragsnummer || `GA-${Date.now()}` } }],
          },
          Prüfgegenstand: {
            rich_text: [{ text: { content: data.pruefgegenstand || "" } }],
          },
          Auftraggeber: {
            rich_text: [{ text: { content: data.auftraggeber || "" } }],
          },
          Werkstoff: {
            select: { name: data.werkstoff || "S355" },
          },
          Bewertungsgruppe: {
            select: { name: data.bewertungsgruppe || "C" },
          },
          Wanddicke: {
            number: parseFloat(data.wanddicke) || null,
          },
          // Fotos als Files Property - ALLE Bilder!
          Fotos: {
            files: filesProperty,
          },
          // Beschreibung mit Anamnese, Diagnose, Conclusio
          Beschreibung: {
            rich_text: [
              {
                text: {
                  content: `ANAMNESE:\n${data.anamnese || "-"}\n\nDIAGNOSE:\n${data.diagnose || "-"}\n\nCONCLUSIO:\n${data.conclusio || "-"}`.substring(0, 2000),
                },
              },
            ],
          },
          Status: {
            select: { name: data.status || "Offen" },
          },
          Prüfdatum: {
            date: { start: new Date().toISOString().split("T")[0] },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Notion API Error:", errorData);
      return { success: false, error: JSON.stringify(errorData) };
    }

    const result = await response.json();
    return {
      success: true,
      pageId: result.id,
      url: result.url,
    };
  } catch (error) {
    console.error("Notion Save Error:", error);
    return { success: false, error: String(error) };
  }
}

export default async (request: Request, context: Context) => {
  // CORS Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // ========== HEALTH CHECK ==========
  if (path === "/api/health" || path === "/.netlify/functions/api/health") {
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
    const hasNotionKey = !!NOTION_API_KEY;
    return new Response(
      JSON.stringify({
        status: "ok",
        anthropic: hasApiKey,
        notion: hasNotionKey,
        cloudinary: true,
        version: "10.1.0",
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ========== GRENZWERTE ==========
  if (path === "/api/grenzwerte" || path === "/.netlify/functions/api/grenzwerte") {
    return new Response(
      JSON.stringify({ grenzwerte: GRENZWERTE, werkstoffgruppen: WERKSTOFFGRUPPEN }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ========== UPLOAD IMAGES TO CLOUDINARY ==========
  if (
    (path === "/api/upload-images" || path === "/.netlify/functions/api/upload-images") &&
    request.method === "POST"
  ) {
    try {
      const { files } = await parseMultipartFormData(request);

      if (files.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "Keine Bilder hochgeladen" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upload ALLE Bilder parallel
      const uploadPromises = files.map((file) => uploadToCloudinary(file));
      const imageUrls = await Promise.all(uploadPromises);

      return new Response(
        JSON.stringify({
          success: true,
          imageUrls,
          count: imageUrls.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Upload Error:", error);
      return new Response(JSON.stringify({ success: false, error: String(error) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ========== SAVE TO NOTION ==========
  if (
    (path === "/api/save-gutachten" || path === "/.netlify/functions/api/save-gutachten") &&
    request.method === "POST"
  ) {
    try {
      const data = await request.json();
      const result = await saveToNotion(data);

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Save Error:", error);
      return new Response(JSON.stringify({ success: false, error: String(error) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ========== CLAUDE VISION ANALYSE ==========
  if (
    (path === "/api/analyze" || path === "/.netlify/functions/api/analyze") &&
    request.method === "POST"
  ) {
    try {
      const { fields, files } = await parseMultipartFormData(request);

      if (files.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "Keine Bilder hochgeladen" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const werkstoff = fields.werkstoff || "S355";
      const bewertungsgruppe = fields.bewertungsgruppe || "C";
      const wanddicke = fields.wanddicke || "nicht angegeben";
      const werkstoffgruppe = WERKSTOFFGRUPPEN[werkstoff] || WERKSTOFFGRUPPEN[werkstoff?.split(" ")[0]] || "1.2";

      // Bilder zu Base64 konvertieren
      const imageContents = await Promise.all(
        files.map(async (file) => {
          const base64 = await fileToBase64(file);
          const mediaType = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
          return {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: mediaType,
              data: base64,
            },
          };
        })
      );

      const client = new Anthropic();

      const systemPrompt = `Du bist ein erfahrener Schweißfachingenieur und gerichtlich beeideter Sachverständiger für Schweißtechnik in Österreich.

WICHTIG: Erstelle einen VOLLSTÄNDIGEN, UMFASSENDEN Bericht. Kürze NICHT ab und lasse KEINE Details aus!

Analysiere Schweißnahtbilder nach:
- EN ISO 5817 (Bewertungsgruppen B, C, D)
- EN ISO 6520-1 (Fehlerklassifikation)
- EN ISO 15614-1 (Verfahrensprüfung)

Werkstoffdaten für diese Prüfung:
- Werkstoff: ${werkstoff} (Gruppe ${werkstoffgruppe})
- Bewertungsgruppe: ISO 5817-${bewertungsgruppe}
- Wanddicke: ${wanddicke} mm
- Härtegrenzwert: ${GRENZWERTE.haerte[werkstoffgruppe]?.max || "kein"} HV10

KRITISCHE FEHLER (Gruppe B nicht zulässig): Risse (100), Bindefehler (401), Durchbrand
BEDINGT ZULÄSSIG: Poren (2011), Einbrandkerben (5011), Nahtüberhöhung (502)`;

      const userPrompt = `Analysiere diese ${files.length} Schweißnaht-Foto(s) und erstelle einen VOLLSTÄNDIGEN Prüfbericht.

WICHTIG: Der Bericht muss VOLLSTÄNDIG und UMFASSEND sein - KEINE Abkürzungen, KEINE Auslassungen!

Antworte EXAKT in diesem JSON-Format:
{
  "vtErgebnis": "bestanden/nicht bestanden/nacharbeit",
  "erkannteFehlercodes": [
    {"code": "XXX", "name": "Fehlername", "kritisch": true/false, "position": "Beschreibung wo", "groesse": "falls messbar"}
  ],
  "anamnese": "AUSFÜHRLICHE Beschreibung (mind. 200 Wörter): Detaillierte Beschreibung ALLER sichtbaren Merkmale der Schweißnaht. Beschreibe: Nahtgeometrie, Oberflächenbeschaffenheit, Nahtbreite, Nahthöhe, Einbrand, Wurzelausbildung, Randkerben, Anlauffarben, Spritzer, Porosität, Risse, Bindefehler, Formabweichungen. Gehe auf JEDES Bild einzeln ein!",
  "diagnose": "VOLLSTÄNDIGE technische Bewertung (mind. 150 Wörter): Detaillierte Bewertung nach ISO 5817 Bewertungsgruppe ${bewertungsgruppe}. Für JEDEN erkannten Fehler: Fehlercode nach ISO 6520-1, zulässige Grenzwerte, gemessene/geschätzte Werte, Bewertung ob innerhalb/außerhalb der Toleranz. Berücksichtige Werkstoffgruppe ${werkstoffgruppe} und eventuelle Sonderanforderungen.",
  "conclusio": "DETAILLIERTE Schlussfolgerung (mind. 100 Wörter): Gesamtbewertung mit klarer Begründung. Bei Nacharbeit: KONKRETE Maßnahmen beschreiben. Bei Ablehnung: alle kritischen Fehler auflisten. Empfehlung für weitere Prüfungen falls erforderlich.",
  "status": "Bestanden/Nacharbeit/Nicht bestanden",
  "empfehlungen": ["Liste konkreter Empfehlungen"],
  "naechstePruefung": "Empfehlung für Folgeprüfung"
}`;

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192, // WICHTIG: Erhöht für vollständige Berichte!
        messages: [
          {
            role: "user",
            content: [...imageContents, { type: "text" as const, text: userPrompt }],
          },
        ],
        system: systemPrompt,
      });

      const textContent = response.content.find((c) => c.type === "text");
      const responseText = textContent && "text" in textContent ? textContent.text : "";

      // JSON aus Response extrahieren
      let analysis;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Kein JSON gefunden");
        }
      } catch {
        analysis = {
          vtErgebnis: "nicht bestanden",
          erkannteFehlercodes: [],
          anamnese: responseText,
          diagnose: "Automatische Analyse - JSON-Parsing fehlgeschlagen",
          conclusio: "Manuelle Überprüfung erforderlich",
          status: "Nacharbeit",
        };
      }

      return new Response(JSON.stringify({ success: true, analysis }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Analysis Error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Analyse fehlgeschlagen",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // ========== 404 ==========
  return new Response(JSON.stringify({ error: "Not found", path }), {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

export const config = {
  path: ["/api/*", "/.netlify/functions/api/*"],
};
