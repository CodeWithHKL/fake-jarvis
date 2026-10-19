import type { AudioEngine } from "./audio";
import { fetchSpeech } from "./api";
import { cleanForSpeech } from "./sentences";

interface SpeakerEvents {
  /** A sentence just started playing; `tag` is whatever was passed to enqueue() for it. */
  onStart(tag: number): void;
  /** Something failed (e.g. TTS down). Playback carries on with the next sentence. */
  onError(message: string): void;
}

/**
 * Speaks sentences one after another.
 *
 * As soon as a sentence is queued we start downloading its audio, so by the
 * time the previous sentence finishes the next one is usually ready. That's
 * what keeps the gaps short.
 *
 * Make one Speaker per reply; `cancel()` makes it unusable.
 */
export class Speaker {
  private queue: { audio: Promise<ArrayBuffer | null>; tag: number }[] = []; // in speaking order
  private running = false;
  private cancelled = false;
  private waiters: (() => void)[] = [];
  private abort = new AbortController();

  constructor(
    private engine: AudioEngine,
    private events: SpeakerEvents,
  ) {}

  /**
   * Add a sentence to the end of the queue. `tag` is handed back to onStart when
   * this sentence begins, so the UI can highlight how far along the reply is.
   */
  enqueue(sentence: string, tag = 0): void {
    const text = cleanForSpeech(sentence);
    if (this.cancelled || !/[\p{L}\p{N}]/u.test(text)) return; // nothing speakable
    const download = fetchSpeech(text, this.abort.signal).catch((err) => {
      if (!this.cancelled) this.events.onError(err instanceof Error ? err.message : "Text-to-speech failed.");
      return null; // skip this sentence
    });
    this.queue.push({ audio: download, tag });
    void this.pump();
  }

  /** Resolves once everything queued so far has been spoken. */
  whenDone(): Promise<void> {
    if (!this.running && this.queue.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  /** Stop talking right now and forget anything still queued. */
  cancel(): void {
    this.cancelled = true;
    this.queue = [];
    this.abort.abort();
    this.engine.stopPlayback();
  }

  /** Play queued sentences in order; only one pump loop runs at a time. */
  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0 && !this.cancelled) {
      const { audio: download, tag } = this.queue.shift()!;
      const audio = await download;
      if (!audio || this.cancelled) continue;
      try {
        this.events.onStart(tag);
        await this.engine.play(audio);
      } catch {
        this.events.onError("Couldn't play the audio in this browser.");
      }
    }
    this.running = false;
    this.waiters.splice(0).forEach((resolve) => resolve());
  }
}
