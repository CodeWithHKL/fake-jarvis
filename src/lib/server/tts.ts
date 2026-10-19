import "server-only";
import { EdgeTTS } from "@andresaya/edge-tts";

/**
 * TTS module. To swap edge-tts for another voice service, rewrite only this
 * file: keep `synthesize(text) -> Buffer of mp3 audio`.
 */

export const VOICE = "en-US-BrianNeural";

/** Very long text is slow to synthesize, so cap it. */
export const MAX_TTS_CHARS = 1000;

/** If Microsoft's service stalls, fail instead of hanging the request until Vercel kills it. */
const TIMEOUT_MS = 15_000;

/** Convert text to MP3 bytes. */
export async function synthesize(text: string): Promise<Buffer> {
  // `generate` returns its own result (no shared state), so several
  // sentences can be synthesized at the same time safely.
  const tts = new EdgeTTS();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("TTS timed out")), TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([
      tts.generate(text, VOICE, { outputFormat: "audio-24khz-48kbitrate-mono-mp3" }),
      timeout,
    ]);
    return Buffer.from(result.audio);
  } finally {
    clearTimeout(timer);
  }
}
