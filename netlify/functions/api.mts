import Anthropic from "@anthropic-ai/sdk";
import type { Context, Config } from "@netlify/functions";

const GRENZWERTE = {
  haerte: {
    "1.1": { max: 380, norm: "ISO 15614-1 Tab.2" },
    "1.2": { max: 380, norm: "ISO 15614-1 Tab.2" },
    "2": { max: 450, norm: "ISO 15614-1 Tab.2" },
    "3": { max: 450, norm: "ISO 15614-1 Tab.2" },
    "8.1": { max: null, norm: "ISO 15614-1" },
    "10": { max: 350, norm: "ISO 15614-1 Tab.2" }
  },
  zugfestigkeit: {
    "S235": { min: 360, norm: "EN 10025-2" },
    "S275": { min: 410, norm: "EN 10025-2" },
    "S355": { min: 470, norm: "EN 10025-2" },
    "S355J2+N": { min: 470, norm: "EN 10025-2" },
    "S460": { min: 540, norm: "EN 10025-2" },
    "S690": { min: 770, norm: "EN 10025-6" },
    "1.4301": { min: 520, norm: "EN 10088-2" },
    "1.4571": { min: 520, norm: "EN 10088-2" },
    "1.4462": { min: 640, norm: "EN 10088-2" }
  },
  biegeversuch: { standardWinkel: 180, maxRisslaenge: 3, norm: "ISO 5173" }
};

const WERKSTOFFGRUPPEN: Record<string, string> = {
  "S235": "1.1", "S275": "1.1", "S355": "1.2", "S355J2+N": "1.2",
  "S460": "2", "S690": "3", "1.4301": "8.1", "1.4571": "8.1", "1.4462": "10"
};

const FEHLERKATALOG: Record<string, { name: string; kritisch: boolean }> = {
  "100": { name: "Riss", kritisch: true },
  "104": { name: "Kraterriss", kritisch: true },
  "2011": { name: "Pore", kritisch: false },
  "401": { name: "Bindefehler", kritisch: true },
  "402": { name: "Einbrandfehler", kritisch: true },
  "502": { name: "Nahtüberhöhung", kritisch: false },
  "507": { name: "Schweißspritzer", kritisch: false }
};

const getWerkstoffgruppe = (w: string): string => 
  WERKSTOFFGRUPPEN[w] || WERKSTOFFGRUPPEN[w?.split(" ")[0]] || "1.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default async (req: Request, context: Context) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace("/.netlify/functions/api", "").replace("/api", "");

  // Health check
  if (path === "/health" || path === "") {
    return Response.json(
      { status: "ok", anthropic: !!Netlify.env.get("ANTHROPIC_API_KEY"), version: "v10.0-Netlify" },
      { headers: corsHeaders }
    );
  }

  // Grenzwerte
  if (path === "/grenzwerte") {
    return Response.json(
      { grenzwerte: GRENZWERTE, werkstoffgruppen: WERKSTOFFGRUPPEN, fehlerkatalog: FEHLERKATALOG },
      { headers: corsHeaders }
    );
  }

  // Werkstoffgruppe
  if (path.startsWith("/werkstoffgruppe/")) {
    const werkstoff = decodeURIComponent(path.split("/")[2] || "");
    const gruppe = getWerkstoffgruppe(werkstoff);
    return Response.json(
      { werkstoff, gruppe, haerteGrenzwert: (GRENZWERTE.haerte as any)[gruppe], zugfestigkeitGrenzwert: (GRENZWERTE.zugfestigkeit as any)[werkstoff?.split(" ")[0]] },
      { headers: corsHeaders }
    );
  }

  // Analyze endpoint
  if (path === "/analyze" && req.method === "POST") {
    try {
      const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) {
        return Response.json({ success: false, error: "ANTHROPIC_API_KEY nicht konfiguriert" }, { status: 500, headers: corsHeaders });
      }

      const formData = await req.formData();
      const images = formData.getAll("images") as File[];
      const werkstoff = formData.get("werkstoff") as string || "S355";
      const bewertungsgruppe = formData.get("bewertungsgruppe") as string || "C";
      const wanddicke = formData.get("wanddicke") as string || "";

      if (images.length === 0) {
        return Response.json({ success: false, error: "Keine Bilder" }, { status: 400, headers: corsHeaders });
      }

      const gruppe = getWerkstoffgruppe(werkstoff);
      const haerteGrenz = (GRENZWERTE.haerte as any)[gruppe];
      const zugGrenz = (GRENZWERTE.zugfestigkeit as any)[werkstoff?.split(" ")[0]];

      const imageLabels = ["Draufsicht", "Wurzelseite", "Seitenansicht", "Detail"];
      const imageContents = await Promise.all(
        images.map(async (file) => {
          const buffer = await file.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          return {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: base64
            }
          };
        })
      );

      const imageDescriptions = images.map((_, i) => `Bild ${i + 1}: ${imageLabels[i] || "Zusatz"}`).join("\n");

      const systemPrompt = `Du bist ein gerichtlich beeideter Sachverständiger für Schweißtechnik.
WERKSTOFFDATEN: Werkstoff: ${werkstoff} (Gruppe ${gruppe}), Bewertungsgruppe: ISO 5817 ${bewertungsgruppe}, Wanddicke: ${wanddicke} mm
Härte-Grenzwert: ${haerteGrenz ? `max. ${haerteGrenz.max} HV10` : "kein"}, Zugfestigkeit-Grenzwert: ${zugGrenz ? `min. ${zugGrenz.min} N/mm²` : "n.a."}

Analysiere nach ISO 5817, ISO 17637, ISO 6520-1. Erstelle:
**ANAMNESE** (Befundaufnahme): Geometrie, Oberfläche, Unregelmäßigkeiten
**DIAGNOSE** (Klassifikation): Einteilung nach ISO 6520-1 mit Code, Bewertung nach ISO 5817 Gruppe ${bewertungsgruppe}
**CONCLUSIO** (Gesamtbewertung): BESTANDEN / NACHARBEIT ERFORDERLICH / NICHT BESTANDEN`;

      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: [
            ...imageContents,
            { type: "text", text: `Analysiere ${images.length} Schweißnaht-Aufnahme(n):\n${imageDescriptions}` }
          ]
        }]
      });

      const analysisText = (response.content[0] as any).text;

      const extractSection = (text: string, name: string): string => {
        const patterns = [
          new RegExp(`\\*\\*${name}\\*\\*[:\\s]*([\\s\\S]*?)(?=\\*\\*[A-ZÄÖÜ]|$)`, "i"),
          new RegExp(`${name}[:\\s]*\\n([\\s\\S]*?)(?=\\n[A-ZÄÖÜ]{4,}|$)`, "i")
        ];
        for (const p of patterns) {
          const m = text.match(p);
          if (m && m[1]?.trim()) return m[1].trim();
        }
        return "";
      };

      const anamnese = extractSection(analysisText, "ANAMNESE");
      const diagnose = extractSection(analysisText, "DIAGNOSE");
      const conclusio = extractSection(analysisText, "CONCLUSIO");

      const conclusioLower = conclusio.toLowerCase();
      let status = "Bestanden";
      if (conclusioLower.includes("nicht bestanden") || conclusioLower.includes("abgelehnt")) status = "Nicht bestanden";
      else if (conclusioLower.includes("nacharbeit") || conclusioLower.includes("bedingt")) status = "Nacharbeit";

      const vtErgebnis = status === "Nicht bestanden" ? "nicht bestanden" : status === "Nacharbeit" ? "nacharbeit" : "bestanden";

      const erkannteFehlercodes: Array<{ code: string; name: string; kritisch: boolean }> = [];
      for (const [code, info] of Object.entries(FEHLERKATALOG)) {
        if (diagnose.includes(code) || analysisText.includes(code)) {
          erkannteFehlercodes.push({ code, ...info });
        }
      }

      return Response.json({
        success: true,
        analysis: {
          volltext: analysisText,
          anamnese,
          diagnose,
          conclusio,
          status,
          vtErgebnis,
          erkannteFehlercodes,
          werkstoffDaten: { werkstoff, gruppe, bewertungsgruppe, wanddicke, haerteGrenzwert: haerteGrenz, zugfestigkeitGrenzwert: zugGrenz },
          timestamp: new Date().toISOString(),
          bildAnzahl: images.length
        }
      }, { headers: corsHeaders });

    } catch (error: any) {
      console.error("Analyse-Fehler:", error);
      return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
    }
  }

  return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
};

export const config: Config = {
  path: ["/api/*", "/api"]
};
