import { streamReply, toLlmError, type ChatMessage } from "@/lib/server/llm";

// Node runtime (not edge) so the Cohere SDK works everywhere; give long replies time on Vercel.
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGES = 20; // only send recent history: cheaper, faster
const MAX_CHARS = 2000;

/** Check the request body really is a list of {role, content} messages. */
function parseMessages(body: unknown): ChatMessage[] | null {
  const list = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(list) || list.length === 0) return null;
  const cleaned: ChatMessage[] = [];
  for (const m of list.slice(-MAX_MESSAGES)) {
    const role = m?.role;
    const content = typeof m?.content === "string" ? m.content.slice(0, MAX_CHARS) : "";
    if ((role !== "user" && role !== "assistant") || !content.trim()) return null;
    cleaned.push({ role, content });
  }
  return cleaned.at(-1)?.role === "user" ? cleaned : null;
}

export async function POST(req: Request) {
  const messages = parseMessages(await req.json().catch(() => null));
  if (!messages) return Response.json({ error: "Invalid request." }, { status: 400 });

  const encoder = new TextEncoder();
  const iterator = streamReply(messages);

  // Pull the first piece *before* responding, so rate-limit / key errors
  // become a proper HTTP error status instead of a broken stream.
  let first: IteratorResult<string>;
  try {
    first = await iterator.next();
  } catch (err) {
    const e = toLlmError(err);
    return Response.json({ error: e.message }, { status: e.status });
  }

  // Stream plain text to the browser as it arrives.
  const body = new ReadableStream({
    async start(controller) {
      try {
        let step = first;
        while (!step.done) {
          controller.enqueue(encoder.encode(step.value));
          step = await iterator.next();
        }
        controller.close();
      } catch (err) {
        controller.error(err); // the client sees a failed stream and shows a message
      }
    },
    cancel() {
      void iterator.return(undefined); // browser hung up: stop the Cohere stream
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
