"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { streamChat, type ChatMessage } from "@/lib/client/api";
import { AudioEngine } from "@/lib/client/audio";
import { pickGreeting } from "@/lib/greetings";
import { SentenceSplitter } from "@/lib/client/sentences";
import { Speaker } from "@/lib/client/speaker";
import { createRecognizer, isSttSupported, type Recognizer } from "@/lib/client/stt";
import { DoodleBackground } from "./DoodleBackground";
import { Visualizer } from "./Visualizer";

type Status = "idle" | "listening" | "thinking" | "speaking";
type Message = ChatMessage & { id: number };

const STATUS_LABEL: Record<Status, string> = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

/** Tappable prompts shown before the first question. */
const STARTERS = ["Tell me a joke", "Give me a fun fact", "Explain something simply", "Hype me up"];

/** True when the keyboard focus is somewhere you'd type, so Space should type a space. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [interim, setInterim] = useState(""); // live transcript while you talk
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false); // false until the user starts the session
  const [sttOk, setSttOk] = useState(true);
  // How many characters of the latest reply have been spoken so far. The caption
  // brightens up to this point. Infinity means "all of it" (done, muted, or cancelled).
  const [spoken, setSpoken] = useState(Infinity);

  // Things that must survive re-renders but shouldn't cause one are kept in refs.
  const engineRef = useRef<AudioEngine | null>(null);
  const recognizerRef = useRef<Recognizer | null>(null);
  const speakerRef = useRef<Speaker | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null); // the reply currently being fetched
  const messagesRef = useRef<Message[]>([]);
  const mutedRef = useRef(false);
  const startedRef = useRef(false);
  const nextId = useRef(1);
  const hold = useRef({ active: false, released: false, ended: false, text: "" });
  const logRef = useRef<HTMLDivElement>(null);

  const getEngine = useCallback(() => (engineRef.current ??= new AudioEngine()), []);
  const getAnalyser = useCallback(() => engineRef.current?.getAnalyser() ?? null, []);

  // Keep refs in sync with state so event handlers always see the latest values.
  useEffect(() => {
    messagesRef.current = messages;
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); // keep newest history in view
  }, [messages]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Browser-only setup: speech support check and the saved mute choice.
  useEffect(() => {
    setSttOk(isSttSupported());
    try {
      setMuted(localStorage.getItem("muted") === "1");
    } catch {}
  }, []);

  /** Stop whatever the assistant is doing: talking, streaming, or waiting. */
  const cancelTurn = useCallback(() => {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    speakerRef.current?.cancel();
    speakerRef.current = null;
    setSpoken(Infinity); // show the whole (possibly partial) reply at full brightness
  }, []);

  const stopEverything = useCallback(() => {
    cancelTurn();
    setStatus("idle");
  }, [cancelTurn]);

  /** One full turn: send text to the LLM, stream the reply, speak it sentence by sentence. */
  const submit = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      cancelTurn();
      setError(null);
      setInterim("");

      const userMsg: Message = { id: nextId.current++, role: "user", content: text };
      const replyMsg: Message = { id: nextId.current++, role: "assistant", content: "" };
      // Only completed messages go to the model (skip empty placeholders).
      const history: ChatMessage[] = [...messagesRef.current, userMsg]
        .filter((m) => m.content)
        .map(({ role, content }) => ({ role, content }));
      setMessages((m) => [...m, userMsg, replyMsg]);
      setStatus("thinking");
      setSpoken(mutedRef.current ? Infinity : 0);

      const controller = new AbortController();
      chatAbortRef.current = controller;
      const isCurrent = () => chatAbortRef.current === controller;

      // Speaker is skipped entirely when muted.
      let ttsErrorShown = false;
      const speaker = mutedRef.current
        ? null
        : new Speaker(getEngine(), {
            onStart: (end) => {
              if (!isCurrent()) return;
              setStatus("speaking");
              setSpoken(end); // this sentence is now being spoken, so light it up
            },
            onError: (msg) => {
              if (!isCurrent() || ttsErrorShown) return;
              ttsErrorShown = true; // one banner is enough, not one per sentence
              setError(msg);
            },
          });
      speakerRef.current = speaker;
      if (speaker) void getEngine().unlock().catch(() => {});

      const splitter = new SentenceSplitter();
      let received = "";
      let cursor = 0; // where the last queued sentence ended inside `received`
      /** Queue a sentence, tagged with where it ends in the full reply text. */
      const speak = (sentence: string) => {
        cursor = received.indexOf(sentence, cursor) + sentence.length;
        speaker?.enqueue(sentence, cursor);
      };
      try {
        await streamChat(
          history,
          (chunk) => {
            received += chunk;
            setMessages((all) => all.map((m) => (m.id === replyMsg.id ? { ...m, content: received } : m)));
            // Every finished sentence goes straight to the speaker.
            for (const sentence of splitter.push(chunk)) speak(sentence);
          },
          controller.signal,
        );
        const rest = splitter.flush();
        if (rest) speak(rest);
        await speaker?.whenDone();
      } catch (err) {
        if (controller.signal.aborted) return; // we cancelled on purpose
        speaker?.cancel();
        setError(err instanceof Error ? err.message : "Something went wrong.");
        // Nothing arrived: remove the empty exchange so history stays clean.
        if (!received) setMessages((all) => all.filter((m) => m.id !== userMsg.id && m.id !== replyMsg.id));
      } finally {
        if (isCurrent()) {
          chatAbortRef.current = null;
          speakerRef.current = null;
          setSpoken(Infinity);
          setStatus("idle");
        }
      }
    },
    [cancelTurn, getEngine],
  );

  /**
   * Begin the session: say a random greeting. This has to happen from a click or
   * keypress, because browsers don't allow sound before the user interacts.
   */
  const startSession = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);

    const greeting = pickGreeting();
    setMessages([{ id: nextId.current++, role: "assistant", content: greeting }]);
    if (mutedRef.current) return;

    const engine = getEngine();
    void engine.unlock().catch(() => {});
    const speaker: Speaker = new Speaker(engine, {
      onStart: (end) => {
        if (speakerRef.current !== speaker) return;
        setStatus("speaking");
        setSpoken(end);
      },
      onError: (msg) => speakerRef.current === speaker && setError(msg),
    });
    speakerRef.current = speaker;
    setStatus("thinking"); // while the greeting audio downloads
    setSpoken(0);
    speaker.enqueue(greeting, greeting.length);
    void speaker.whenDone().then(() => {
      if (speakerRef.current === speaker) {
        speakerRef.current = null;
        setSpoken(Infinity);
        setStatus("idle");
      }
    });
  }, [getEngine]);

  /** Called when the mic key/button is pressed. */
  const startListening = useCallback(() => {
    if (hold.current.active) return;
    if (!startedRef.current) {
      startSession(); // the very first press starts the session instead of recording
      return;
    }
    if (!isSttSupported()) {
      setError("Speech recognition isn't supported in this browser. Try Chrome, Edge or Safari, or type instead.");
      return;
    }
    cancelTurn(); // talking over the assistant interrupts it
    setError(null);
    setInterim("");
    setStatus("listening");
    hold.current = { active: true, released: false, ended: false, text: "" };

    const engine = getEngine();
    void engine.unlock().catch(() => {});
    // The mic feeds the visualizer. If this fails, recognition still works.
    engine.startMic().catch(() => {});

    const finishWith = (text: string) => {
      hold.current.active = false;
      engine.stopMic();
      if (text.trim()) void submit(text);
      else {
        setError("Didn't catch that. Hold the key and speak.");
        setStatus("idle");
      }
    };

    recognizerRef.current = createRecognizer({
      onInterim: setInterim,
      onDone: (text) => {
        hold.current.ended = true;
        hold.current.text = text;
        // If recognition stopped by itself while the key is still down, wait for the release.
        if (hold.current.released) finishWith(text);
      },
      onError: (message) => {
        hold.current.active = false;
        engine.stopMic();
        setInterim("");
        setError(message);
        setStatus("idle");
      },
    });
    recognizerRef.current.start();
  }, [cancelTurn, getEngine, startSession, submit]);

  /** Called when the mic key/button is released. */
  const stopListening = useCallback(() => {
    const h = hold.current;
    if (!h.active || h.released) return;
    h.released = true;
    getEngine().stopMic();
    setStatus("thinking"); // waiting for the final transcript
    if (h.ended) {
      // recognition already ended on its own; use what it heard
      h.active = false;
      if (h.text.trim()) void submit(h.text);
      else {
        setError("Didn't catch that. Hold the key and speak.");
        setStatus("idle");
      }
    } else {
      recognizerRef.current?.stop(); // onDone will fire with the final text
    }
  }, [getEngine, submit]);

  // Hold Space anywhere on the page (except while typing in the text box).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTyping(e.target)) return;
      e.preventDefault(); // stop the page scrolling / a focused button clicking
      if (!e.repeat) startListening();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTyping(e.target)) return;
      e.preventDefault();
      stopListening();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", stopListening); // tab switched while holding
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", stopListening);
    };
  }, [startListening, stopListening]);

  // Clean up if the component unmounts mid-conversation.
  useEffect(() => {
    return () => {
      recognizerRef.current?.abort();
      engineRef.current?.stopMic();
      chatAbortRef.current?.abort();
      speakerRef.current?.cancel();
    };
  }, []);

  function toggleMuted() {
    const next = !muted;
    setMuted(next);
    if (next) speakerRef.current?.cancel(); // silence the current reply too
    try {
      localStorage.setItem("muted", next ? "1" : "0");
    } catch {}
  }

  const busy = status === "thinking" || status === "speaking";
  const listening = status === "listening";

  // Landing view: nothing but a title and one button until the session starts.
  if (!started) {
    return (
      <div className="assistant">
        <div className="landing">
          <DoodleBackground />
          <span className="logo">
            <i className="mic-icon" />
          </span>
          <h1>Jarvis</h1>
          <p className="muted">A fake Jarvis at your service.</p>
          <button type="button" className="btn primary start" onClick={startSession}>
            Start
          </button>
          <p className="hint">
            <kbd>Space</kbd> to start, then hold to talk
          </p>
          <p className="by">
            <span>By</span>
            <a href="https://hklx.vercel.app/" target="_blank" rel="noopener noreferrer">
              Hklx
            </a>
          </p>
        </div>
      </div>
    );
  }

  // The latest exchange (your last question + Jarvis's answer) is the focus of the
  // screen; everything before it is shown small and faded above.
  const lastUser = messages.findLastIndex((m) => m.role === "user");
  const older = messages.slice(0, Math.max(lastUser, 0));
  const current = messages.slice(Math.max(lastUser, 0));
  const question = current.find((m) => m.role === "user");
  const reply = current.findLast((m) => m.role === "assistant");

  // Before the first question, offer a few things to try (handy when there's no mic).
  const showChips = messages.length <= 1 && status === "idle";

  // What the big caption says right now.
  let caption: React.ReactNode = null;
  if (listening) {
    caption = interim || <span className="faint">Listening…</span>;
  } else if (reply?.content.trim()) {
    // Spoken part at full brightness, the rest dimmed until the voice gets there.
    const text = reply.content.trim();
    const cut = Math.min(spoken, text.length);
    caption = (
      <>
        {text.slice(0, cut)}
        <span className="faint">{text.slice(cut)}</span>
      </>
    );
  } else if (status === "thinking") {
    caption = <span className="faint">Thinking…</span>;
  }

  return (
    <div className="assistant">
      {older.length > 0 && (
        <div className="history" ref={logRef}>
          {older.map((m) => (
            <p key={m.id} className={m.role}>
              <span>{m.role === "user" ? "You" : "Jarvis"}</span> {m.content.trim()}
            </p>
          ))}
        </div>
      )}

      <div className="stage">
        <Visualizer getAnalyser={getAnalyser} mode={status} />
        <div className="caption" aria-live="polite">
          {question && !listening && <p className="said">“{question.content}”</p>}
          <p className="reply">{caption}</p>
        </div>
      </div>

      <div className="dock">
        {showChips && (
          <div className="chips">
            {STARTERS.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => void submit(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="status-row">
          <span className={`status ${status}`}>
            <i className="dot" />
            {STATUS_LABEL[status]}
          </span>
          <button type="button" className="link" onClick={toggleMuted} aria-pressed={muted}>
            {muted ? "Voice off" : "Voice on"}
          </button>
        </div>

        {error && (
          <div className="error" role="alert">
            <span>{error}</span>
            <button type="button" className="link" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        <div className="composer">
          {busy && (
            <button type="button" className="btn" onClick={stopEverything}>
              Stop
            </button>
          )}
          <button
            type="button"
            className={`btn primary mic ${listening ? "live" : ""}`}
            disabled={!sttOk}
            title={sttOk ? "Hold to talk (or hold Space)" : "Speech recognition isn't supported in this browser"}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId); // keep getting events if the pointer drifts off
              startListening();
            }}
            onPointerUp={stopListening}
            onPointerCancel={stopListening}
            onContextMenu={(e) => e.preventDefault()}
          >
            <i className="mic-icon" />
            {listening ? "Release to send" : "Hold to talk"}
          </button>
        </div>
      </div>
    </div>
  );
}
