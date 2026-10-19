<h1 align="center">TTS Voice AI</h1>

<p align="center">
  A press-to-talk voice assistant with a Gen Z personality. Hold <kbd>Space</kbd>, say something, and Jarvis answers out loud.
</p>

A personal project built to learn how the pieces of a voice assistant fit together: speech recognition, a streaming LLM, text-to-speech, and the Web Audio API.

## Features

- **Press-to-talk.** Hold `Space` (or the on-screen button) to talk, release to send. Talking over Jarvis interrupts it.
- **Fast replies.** The answer streams in, and each finished sentence is spoken while the rest is still being written, so you hear the start of a reply almost right away.
- **Live captions.** Your words show up as you speak. Jarvis's reply is shown in large text and brightens sentence by sentence as it is spoken.
- **Audio visualizer.** Mirrored frequency bars react to your microphone while you talk and to Jarvis's voice while it speaks.
- **A personality.** Jarvis talks like a friendly, witty Gen Z friend, keeps answers short, and starts every session with a random greeting.
- **Starter prompts.** Tappable suggestions ("Tell me a joke", ...) so it is easy to try without a microphone.
- **Light, dark and system themes.** A three-way switch in the header, remembered between visits, with no flash on load.
- **An interactive landing page.** Hand-drawn robotics doodles that follow your cursor. The robot's eyes track the mouse, the gears turn as you move across the screen, and everything reacts to hover and click.
- **Handles failure gracefully.** No or blocked microphone, unsupported browser, rate limits, a bad key, a dropped connection, or a stalled voice service all produce a plain message instead of a crash.

## How it works

```
hold Space -> microphone -> speech-to-text -> Cohere chat (streamed) -> text-to-speech -> speaker
                                                      |                       ^
                                                      +-- split into sentences, speak each as soon as it is complete
```

1. **Listen.** While you hold the key, the browser's Web Speech API turns your voice into text. The microphone also feeds a Web Audio analyser that drives the visualizer.
2. **Think.** On release, the conversation is sent to `/api/chat`, which streams Cohere's reply back as plain text.
3. **Speak.** The browser cuts the incoming text into sentences. Each sentence goes to `/api/tts`, which returns MP3 audio from Microsoft Edge's voice service (`en-US-BrianNeural`). The next sentence is downloaded while the current one plays, which keeps the gaps short.

## Tech stack

| Part | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) with React 19 and TypeScript |
| Speech to text | Browser Web Speech API |
| LLM | [Cohere](https://cohere.com) (`command-a-03-2025`) through the official SDK, server side only |
| Text to speech | [`@andresaya/edge-tts`](https://www.npmjs.com/package/@andresaya/edge-tts), voice `en-US-BrianNeural` |
| Audio and visuals | Web Audio API, Canvas 2D, inline SVG |
| Styling | Plain CSS with custom properties (no UI framework) |
| Fonts | Geist, Geist Mono, Anton and Yellowtail via `next/font/google` |
| Hosting | Built for Vercel |

## Getting started

You need **Node.js 20.9 or newer** and a free Cohere API key.

```bash
# 1. Install dependencies
npm install

# 2. Add your key
cp .env.example .env.local        # Windows PowerShell: Copy-Item .env.example .env.local
# then open .env.local and set COHERE_API_KEY (free at https://dashboard.cohere.com/api-keys)

# 3. Run it
npm run dev                       # http://localhost:3000
```

Open it in **Chrome, Edge or Safari**, click **Start** (or press `Space`), and allow microphone access when asked.

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Make a production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | Run the TypeScript compiler without emitting files |

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `COHERE_API_KEY` | Yes | Your Cohere API key. Only ever read on the server. |
| `COHERE_MODEL` | No | Override the chat model (default `command-a-03-2025`). |

`.env.local` is git-ignored. Never commit a real key; `.env.example` is the only env file that belongs in the repo.

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts      # POST: validates messages, streams the Cohere reply as text
│   │   └── tts/route.ts       # POST: turns one sentence into MP3 audio
│   ├── layout.tsx             # fonts, metadata, and the no-flash theme script
│   ├── page.tsx               # header + assistant
│   ├── globals.css            # theme tokens and all styling
│   └── icon.svg               # favicon
├── components/
│   ├── Assistant.tsx          # the state machine that ties listening, thinking and speaking together
│   ├── Visualizer.tsx         # canvas frequency bars
│   ├── DoodleBackground.tsx   # interactive landing-page doodles
│   └── ThemeToggle.tsx        # system / light / dark switch
└── lib/
    ├── greetings.ts           # the random opening lines
    ├── server/                # server only (the key never reaches the browser)
    │   ├── llm.ts             # Cohere client, system prompt, error mapping
    │   └── tts.ts             # edge-tts wrapper with a timeout
    └── client/
        ├── stt.ts             # Web Speech API wrapper
        ├── audio.ts           # Web Audio engine: microphone, playback, analyser
        ├── speaker.ts         # sentence queue that downloads ahead while playing
        ├── sentences.ts       # splits a streaming reply into sentences
        ├── api.ts             # fetch helpers with friendly errors
        └── theme.ts           # reads and writes the saved theme
```

## Swapping a stage

Speech-to-text, the LLM and text-to-speech each live behind one small module, so any of them can be replaced without touching the rest of the app.

| Stage | File | Keep this interface |
| --- | --- | --- |
| Speech to text | `src/lib/client/stt.ts` | `isSttSupported()` and `createRecognizer(handlers)` (for example to use Whisper) |
| LLM | `src/lib/server/llm.ts` | `streamReply(history)` as an async generator of text, plus `toLlmError(err)` |
| Text to speech | `src/lib/server/tts.ts` | `synthesize(text)` returning an MP3 `Buffer` |

## Customizing

- **Personality and length.** Edit `SYSTEM_PROMPT` in `src/lib/server/llm.ts`.
- **Greetings.** Add or change lines in `src/lib/greetings.ts`. They are spoken aloud, so avoid emojis and markdown.
- **Starter prompts.** Edit `STARTERS` in `src/components/Assistant.tsx`.
- **Voice.** Change `VOICE` in `src/lib/server/tts.ts` to any [edge-tts voice](https://github.com/rany2/edge-tts), for example another `en-US-...Neural` voice.
- **Landing doodles.** Each doodle is an entry in the `DOODLES` list in `src/components/DoodleBackground.tsx`. Cursor strength is set by `PARALLAX`, `REPEL_RADIUS`, `REPEL_STRENGTH`, `GEAR_TURNS` and `EYE_REACH` at the top of that file.

## Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel.
2. Under **Settings → Environment Variables**, add `COHERE_API_KEY`. Vercel does not read `.env.local`.
3. Deploy.

Both API routes run on the Node.js runtime. The chat route asks for up to 60 seconds and the TTS route for up to 30.

## Good to know

- **Browser support.** Speech recognition needs the Web Speech API, which Chrome, Edge and Safari have. **Firefox does not**, so there you can only use the starter prompts. In Chrome, the audio is processed by Google's servers, so recognition needs an internet connection.
- **You press Start first.** Browsers block sound until you interact with the page, so Jarvis cannot speak the moment the page loads. Clicking Start (or pressing `Space`) unlocks audio and plays the greeting.
- **Where your data goes.** Your speech goes to your browser's speech service. The text of your conversation goes to Cohere. Each sentence of a reply goes to Microsoft's text-to-speech service. This app has no database and stores nothing on a server: the conversation lives in memory until you reload, and only your theme and Voice on/off choice are saved in your browser's local storage.
- **The voice service is unofficial.** edge-tts uses Microsoft Edge's online voices through an endpoint that is not an official public API. That is fine for a portfolio project, but it can change without notice. If the voice stops working, `src/lib/server/tts.ts` is the one file to look at. Another library, `edge-tts-universal`, was tried first and was dropped because Microsoft rejects its handshake (HTTP 403) and it hangs instead of reporting an error.
- **Rate limits.** A free Cohere trial key is rate limited. When it is hit, Jarvis says so instead of failing silently.
- **Reduced motion.** If your operating system asks to reduce motion, the slow ambient animations (spinning gears, blinking, bobbing) are switched off. Things that respond to you (the robot's eyes, gears following the cursor, hover, click) still work.
- **TypeScript is pinned to 5.9.** TypeScript 7 failed to load the Next.js config when this project was on Next 16.1, so it stays on 5.9.

## License

Released under the [MIT License](LICENSE). The microphone icon and the fonts keep their own licenses (see Credits).

## Credits

- Microphone icon from [Flaticon](https://www.flaticon.com) (icon id 25682). Flaticon's free license requires crediting the icon's author, so add their attribution line here before sharing the project publicly.
- Fonts: [Geist](https://vercel.com/font), [Geist Mono](https://vercel.com/font), [Anton](https://fonts.google.com/specimen/Anton) and [Yellowtail](https://fonts.google.com/specimen/Yellowtail), served through Google Fonts.
- [Cohere](https://cohere.com) for the language model and [edge-tts](https://github.com/rany2/edge-tts) for the voices.
