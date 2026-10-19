/**
 * Audio engine: one Web Audio context shared by the mic and the speaker.
 *
 *   mic ──┐
 *         ├──> AnalyserNode  (the visualizer reads this)
 *   mp3 ──┤
 *         └──> speakers      (only the mp3 goes here, never the mic, or you'd hear yourself)
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micToken = 0; // lets stopMic() cancel a getUserMedia that is still pending
  private current: AudioBufferSourceNode | null = null;

  /** Create the context on first use (browsers need that to happen after a click/keypress). */
  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256; // 128 frequency bins: plenty for bars
      this.analyser.smoothingTimeConstant = 0.8; // makes the bars move smoothly
    }
    return this.ctx;
  }

  /** Call this from a user gesture so the browser allows sound to play. */
  async unlock(): Promise<void> {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /** Feed the microphone into the analyser. Fails quietly: the visualizer just stays idle. */
  async startMic(): Promise<void> {
    const ctx = this.ensure();
    const token = ++this.micToken;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (token !== this.micToken) {
      // the key was released while the permission prompt was open
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.micStream = stream;
    this.micSource = ctx.createMediaStreamSource(stream);
    this.micSource.connect(this.analyser!);
  }

  stopMic(): void {
    this.micToken++;
    this.micSource?.disconnect();
    this.micStream?.getTracks().forEach((t) => t.stop()); // turns off the browser's "recording" dot
    this.micSource = null;
    this.micStream = null;
  }

  /** Play MP3 bytes. Resolves when playback ends (or is stopped). */
  async play(mp3: ArrayBuffer): Promise<void> {
    const ctx = this.ensure();
    const buffer = await ctx.decodeAudioData(mp3);
    return new Promise((resolve) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.analyser!);
      src.connect(ctx.destination);
      src.onended = () => {
        if (this.current === src) this.current = null;
        resolve();
      };
      this.current = src;
      src.start();
    });
  }

  stopPlayback(): void {
    this.current?.stop(); // fires onended, which resolves the play() promise
  }
}
