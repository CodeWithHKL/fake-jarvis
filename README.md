# Jarvis

A press-to-talk voice assistant. Hold **Space** (or the button), speak, release. Jarvis answers out loud.

```
hold key -> mic -> speech-to-text -> Cohere chat (streamed) -> text-to-speech -> speaker
                                                   |
                          each finished sentence is spoken while the rest is still being written
```

## Run it

```bash
npm install
cp .env.example .env.local     # then paste your Cohere key (free at dashboard.cohere.com/api-keys)
npm run dev                    # http://localhost:3000
```

Use Chrome, Edge or Safari (Firefox has no Web Speech API; typing still works there).

## Deploy to Vercel

Import the repo, add `COHERE_API_KEY` under **Settings > Environment Variables**, deploy.
The key only ever lives on the server (`src/lib/server/llm.ts` imports `server-only`).

## Where things live

Each stage is its own module, so any one can be swapped without touching the others.

| Stage | File | Runs on | To swap it |
| --- | --- | --- | --- |
| STT | `src/lib/client/stt.ts` | browser | keep `isSttSupported` + `createRecognizer` (e.g. Whisper) |
| LLM | `src/lib/server/llm.ts` | server | keep `streamReply` + `toLlmError` |
| TTS | `src/lib/server/tts.ts` | server | keep `synthesize(text) -> mp3 Buffer` |

Supporting code:

- `src/app/api/chat/route.ts` and `src/app/api/tts/route.ts` validate input and stream/return results.
- `src/lib/client/sentences.ts` cuts the streaming reply into sentences.
- `src/lib/client/speaker.ts` downloads audio for upcoming sentences while the current one plays.
- `src/lib/client/audio.ts` is the Web Audio engine; the visualizer reads its analyser.
- `src/components/Assistant.tsx` ties it together; `Visualizer.tsx` draws the bars.

## Errors it handles

No or blocked microphone, unsupported browser, Cohere rate limit (429), bad/missing key, network down,
a dropped stream, and a stalled TTS service. Each shows a plain message and the app keeps working.

## Choices worth knowing

- Voice: `en-US-BrianNeural`. Model: `command-a-03-2025` (override with `COHERE_MODEL`).
- TTS uses `@andresaya/edge-tts`. `edge-tts-universal` was tried first but Microsoft rejects its handshake (HTTP 403), and it hangs instead of throwing.
- edge-tts is an unofficial endpoint, fine for a portfolio project but it can change without notice.
- TypeScript is pinned to 5.9 because Next 16.1 doesn't support TypeScript 7.
