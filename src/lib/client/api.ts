/**
 * Thin wrappers around our two API routes. Components never call fetch directly,
 * so all network error handling lives here.
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** An error whose message is safe to show to the user as-is. */
export class ApiError extends Error {}

const OFFLINE_MESSAGE = "Can't reach the server. Check your internet connection.";

/** Pull a readable message out of a failed response. */
async function errorFrom(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  return new ApiError(body?.error ?? `Something went wrong (error ${res.status}).`);
}

/** Send the conversation to /api/chat and call `onText` for each piece of the reply as it streams in. */
export async function streamChat(
  messages: ChatMessage[],
  onText: (chunk: string) => void,
  signal: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new ApiError(OFFLINE_MESSAGE);
  }
  if (!res.ok) throw await errorFrom(res);
  if (!res.body) throw new ApiError("The server sent an empty reply.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      onText(decoder.decode(value, { stream: true }));
    }
  } catch (err) {
    if (signal.aborted) throw err;
    throw new ApiError("The connection dropped while the reply was streaming.");
  }
}

/** Ask /api/tts to turn one sentence into MP3 bytes. */
export async function fetchSpeech(text: string, signal: AbortSignal): Promise<ArrayBuffer> {
  try {
    return await fetchSpeechOnce(text, signal);
  } catch (err) {
    if (signal.aborted) throw err;
    return fetchSpeechOnce(text, signal); // mobile networks drop requests; one retry
  }
}

async function fetchSpeechOnce(text: string, signal: AbortSignal): Promise<ArrayBuffer> {
  let res: Response;
  try {
    res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new ApiError(OFFLINE_MESSAGE);
  }
  if (!res.ok) throw await errorFrom(res);
  return res.arrayBuffer();
}
