/**
 * STT module (speech to text), browser Web Speech API version.
 * To swap in Whisper later, keep `isSttSupported` and `createRecognizer`
 * with the same shapes and nothing else in the app has to change.
 *
 * Note: Chrome/Edge/Safari support this; Firefox does not. In Chrome the audio
 * is processed by Google's servers, so it needs an internet connection.
 */

// TypeScript doesn't ship types for this API yet, so describe the bits we use.
interface SpeechRecognitionResultLike {
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSttSupported(): boolean {
  return getCtor() !== null;
}

export interface Recognizer {
  start(): void;
  /** Stop listening; `onDone` fires with whatever was heard. */
  stop(): void;
  /** Stop listening and throw the result away. */
  abort(): void;
}

export interface RecognizerHandlers {
  /** Called as words are recognised, with the full text so far. */
  onInterim(text: string): void;
  /** Called once when listening ended normally (text may be empty). */
  onDone(text: string): void;
  /** Called instead of onDone when something went wrong. */
  onError(message: string): void;
}

/** Map the browser's error codes to messages a person can act on. */
function friendlyError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was blocked. Allow it in your browser's address bar and try again.";
    case "audio-capture":
      return "No microphone found. Plug one in or use the text box instead.";
    case "no-speech":
      return "Didn't hear anything. Hold the key and speak.";
    case "network":
      return "Speech recognition needs an internet connection.";
    default:
      return "Speech recognition failed. Try again or type instead.";
  }
}

export function createRecognizer(handlers: RecognizerHandlers): Recognizer {
  const Ctor = getCtor();
  if (!Ctor) {
    // Callers should check isSttSupported() first, but never crash if they don't.
    return {
      start: () => handlers.onError("Speech recognition isn't supported in this browser. Try Chrome, Edge or Safari."),
      stop() {},
      abort() {},
    };
  }

  const rec = new Ctor();
  rec.lang = "en-US";
  // Android Chrome's continuous mode repeats words (each result re-contains the
  // earlier ones), so on touch devices listen for one phrase at a time instead.
  const isTouch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  rec.continuous = !isTouch; // keep listening while the key is held, not just one phrase
  rec.interimResults = true; // give us partial text as the person speaks

  let text = "";
  let failed = false;
  let aborted = false;

  rec.onresult = (e) => {
    // `results` holds every phrase heard so far. Some mobile browsers report
    // cumulative results ("hello", "hello world"), so a result that extends or
    // repeats the previous one replaces it instead of being appended.
    const parts: string[] = [];
    for (const r of Array.from(e.results)) {
      const part = r[0].transcript.trim();
      if (!part) continue;
      const prev = parts[parts.length - 1]?.toLowerCase();
      const cur = part.toLowerCase();
      if (prev !== undefined && cur.startsWith(prev)) parts[parts.length - 1] = part;
      else if (prev === undefined || !prev.startsWith(cur)) parts.push(part);
    }
    text = parts.join(" ");
    handlers.onInterim(text);
  };
  rec.onerror = (e) => {
    if (e.error === "aborted") return;
    failed = true;
    handlers.onError(friendlyError(e.error));
  };
  rec.onend = () => {
    if (!failed && !aborted) handlers.onDone(text);
  };

  return {
    start() {
      try {
        rec.start();
      } catch {
        failed = true;
        handlers.onError("Could not start the microphone. Try again.");
      }
    },
    stop: () => rec.stop(),
    abort() {
      aborted = true;
      rec.abort();
    },
  };
}
