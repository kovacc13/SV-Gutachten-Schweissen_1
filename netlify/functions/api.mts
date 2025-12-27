import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@notionhq/client";
import { v2 as cloudinary } from "cloudinary";
import type { Context } from "@netlify/functions";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
const notion = new Client({ auth: process.env.NOTION_TOKEN || "" });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export default async function handler(req: Request, context: Context) {
  const url = new URL(req.url);
  const path = url.pathname.replace("/.netlify/functions/api", "").replace("/api", "");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    if (path === "/health" || path === "") return await healthCheck();
    if (path === "/analyze" && req.method === "POST") return await analyzeImages(req);
    if (path === "/upload-images" && req.method === "POST") return await uploadImages(req);
    if (path === "/save-gutachten" && req.method === "POST") return await saveToNotion(req);
    return json({ error: "Not found" }, 404);
  } catch (error: any) {
    console.error("API Error:", error);
    return json({ error: error.message }, 500);
  }
}

async function healthCheck() {
  let anthropicOk = !!process.env.ANTHROPIC_API_KEY;
  let notionOk = false;
  let cloudinaryOk = !!(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

  try {
    if (process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID) {
      await notion.databases.retrieve({ database_id: NOTION_DATABASE_ID });
      notionOk = true;
    }
  } catch (e) {
    console.error("Notion check failed:", e);
  }

  return json({ status: "ok", anthropic: anthropicOk, notion: notionOk, cloudinary: cloudinaryOk, version: "10.2.0" });
}

async function analyzeImages(req: Request) {
  const formData = await req.formData();
  const images = formData.getAll("images") as File[];
  const werkstoff = (formData.get("werkstoff") as string) || "S355";
  const bewertungsgruppe = (formData.get("bewertungsgruppe") as string) || "C";
  const wanddicke = (formData.get("wanddicke") as string) || "";

  if (!images.length) return json({ success: false, error: "Keine Bilder" }, 400);

  const imageContents = await Promise.all(
    images.map(async (img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: (img.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: Buffer.from(await img.arrayBuffer()).toString("base64"),
      },
    }))
  );

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: `Du bist ein gerichtlich beeideter Sachverständiger für Schweißtechnik. Analysiere nach EN ISO 5817 Bewertungsgruppe ${bewertungsgruppe}. Werkstoff: ${werkstoff}, Wanddicke: ${wanddicke || "k.A."} mm.

Antworte NUR in diesem JSON-Format:
{
  "vtErgebnis": "bestanden/nicht bestanden/nacharbeit",
  "anamnese": "Ausführliche Beschreibung der Schweißnaht...",
  "diagnose": "Technische Analyse mit ISO 6520-1 Codes...",
  "conclusio": "Gesamtbewertung und Empfehlungen...",
  "status": "Bestanden/Nicht bestanden/Nacharbeit",
  "erkannteFehlercodes": [{"code": "5011", "name": "Einbrandkerbe", "kritisch": false}]
}`,
    messages: [{ role: "user", content: [...imageContents, { type: "text", text: `Analysiere diese ${images.length} Schweißnaht-Foto(s).` }] }],
  });

  const text = response.content.find((c) => c.type === "text");
  if (!text || text.type !== "text") return json({ success: false, error: "Keine Antwort" }, 500);

  try {
    const match = text.text.match(/\{[\s\S]*\}/);
    return json({ success: true, analysis: match ? JSON.parse(match[0]) : { anamnese: text.text, status: "Nacharbeit" } });
  } catch {
    return json({ success: true, analysis: { anamnese: text.text, diagnose: "", conclusio: "", status: "Nacharbeit", erkannteFehlercodes: [] } });
  }
}

async function uploadImages(req: Request) {
  const formData = await req.formData();
  const images = formData.getAll("images") as File[];
  if (!images.length) return json({ success: false, error: "Keine Bilder" }, 400);

  const urls = await Promise.all(
    images.map(async (img) => {
      const b64 = Buffer.from(await img.arrayBuffer()).toString("base64");
      const result = await cloudinary.uploader.upload(`data:${img.type || "image/jpeg"};base64,${b64}`, {
        folder: "schweissapp-gutachten",
      });
      return result.secure_url;
    })
  );

  return json({ success: true, imageUrls: urls });
}

async function saveToNotion(req: Request) {
  const data = await req.json();

  const fotos = (data.fotoUrls || []).map((url: string, i: number) => ({
    type: "external",
    name: `Foto ${i + 1}`,
    external: { url },
  }));

  const page = await notion.pages.create({
    parent: { database_id: NOTION_DATABASE_ID },
    properties: {
      Auftragsnummer: { title: [{ text: { content: data.auftragsnummer || `GA-${Date.now()}` } }] },
      Prüfgegenstand: { rich_text: [{ text: { content: data.pruefgegenstand || "" } }] },
      Auftraggeber: { rich_text: [{ text: { content: data.auftraggeber || "" } }] },
      Werkstoff: data.werkstoff ? { select: { name: data.werkstoff } } : undefined,
      Bewertungsgruppe: data.bewertungsgruppe ? { select: { name: data.bewertungsgruppe } } : undefined,
      Status: data.status ? { select: { name: data.status } } : undefined,
      Wanddicke: data.wanddicke ? { number: parseFloat(data.wanddicke) } : undefined,
      Fotos: { files: fotos },
      Beschreibung: {
        rich_text: [{ text: { content: `ANAMNESE:\n${data.anamnese || ""}\n\nDIAGNOSE:\n${data.diagnose || ""}\n\nCONCLUSIO:\n${data.conclusio || ""}`.substring(0, 2000) } }],
      },
      Prüfdatum: { date: { start: new Date().toISOString().split("T")[0] } },
    },
  });

  return json({ success: true, pageId: page.id, url: `https://notion.so/${page.id.replace(/-/g, "")}` });
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...cors } });
}
