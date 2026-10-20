import { MAX_TTS_CHARS, synthesize } from "@/lib/server/tts";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_TTS_CHARS) : "";
  if (!text) return Response.json({ error: "No text to speak." }, { status: 400 });

  try {
    const audio = await synthesize(text);
    return new Response(new Uint8Array(audio), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("TTS failed:", err);
    return Response.json({ error: "Text-to-speech failed." }, { status: 502 });
  }
}
