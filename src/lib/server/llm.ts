import "server-only"; // build error if a client component ever imports this file
import { CohereClientV2 } from "cohere-ai";

/**
 * LLM module. To swap Cohere for another provider, rewrite only this file:
 * keep the `streamReply` signature and the rest of the app won't notice.
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = [
  "You are Jarvis, a voice assistant. The user talks to you with their microphone and your replies are read aloud by a text-to-speech voice.",
  "Personality: you talk like a friendly, witty Gen Z friend. Casual and warm, a little playful, never rude. Use slang naturally and sparingly (for example: lowkey, no cap, fr, bet, vibe, that's fire, I got you). Do not stack slang in every sentence and do not sound like you are trying too hard.",
  "Speech rules: write exactly how it should be spoken. Plain sentences only. No markdown, no bullet points, no lists, no emojis, no code blocks, no asterisks, no abbreviations that sound odd when read aloud. Never write sounds like 'lol' or 'haha'; just say something funny.",
  "Length: keep replies short, one to three sentences, unless the user asks for detail. Ask at most one follow-up question.",
  "Honesty: you only chat. You cannot browse the web, control devices, set timers or remember things after the session ends, so say so briefly if asked. If you do not know something, say that instead of guessing.",
  "You have already greeted the user at the start of the session, so do not greet them again or re-introduce yourself.",
].join(" ");

/** Thrown for problems we want to show the user in friendly words. */
export class LlmError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Create the client lazily so a missing key gives a clear error, not a crash at import time. */
function getClient() {
  const token = process.env.COHERE_API_KEY;
  if (!token) {
    throw new LlmError("COHERE_API_KEY is not set. Add it to .env.local (or Vercel env vars).", 500);
  }
  return new CohereClientV2({ token });
}

/** Turn any SDK/network error into an LlmError with a friendly message. */
export function toLlmError(err: unknown): LlmError {
  if (err instanceof LlmError) return err;
  const status = (err as { statusCode?: number })?.statusCode;
  if (status === 429) return new LlmError("Rate limit reached. Wait a moment and try again.", 429);
  if (status === 401) return new LlmError("The Cohere API key was rejected. Check COHERE_API_KEY.", 401);
  if (status && status >= 500) return new LlmError("Cohere is having trouble right now.", 502);
  return new LlmError("Could not reach Cohere. Check your connection.", 502);
}

/**
 * Stream the assistant's reply as an async iterator of text pieces.
 * `history` is the whole conversation so far, ending with the newest user message.
 */
export async function* streamReply(history: ChatMessage[]): AsyncGenerator<string> {
  const client = getClient();
  const stream = await client.chatStream({
    model: process.env.COHERE_MODEL || "command-a-03-2025",
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
  });

  for await (const event of stream) {
    // Cohere sends many event types; only "content-delta" carries new text.
    if (event.type === "content-delta") {
      const text = event.delta?.message?.content?.text;
      if (text) yield text;
    }
  }
}
