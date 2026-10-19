"use client";

import { useEffect, useRef } from "react";

const BARS = 41; // odd number so there is a bar exactly in the middle
const USEFUL_BINS = 70; // voice lives in the low bins (~0-6 kHz), so ignore the rest

export type VisualizerMode = "idle" | "listening" | "thinking" | "speaking";

interface Props {
  /** Returns the live AnalyserNode (or null before audio has started). */
  getAnalyser: () => AnalyserNode | null;
  mode: VisualizerMode;
}

/**
 * Draws mirrored frequency bars on a canvas: low sounds in the middle,
 * higher sounds toward the edges. Reads the mic while listening and the
 * assistant's voice while speaking (both go through the same analyser).
 */
export function Visualizer({ getAnalyser, mode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keep the latest props in refs so the animation loop never has to restart.
  const modeRef = useRef(mode);
  const getAnalyserRef = useRef(getAnalyser);
  useEffect(() => {
    modeRef.current = mode;
    getAnalyserRef.current = getAnalyser;
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const levels = new Float32Array(BARS); // current height of each bar, 0..1
    let data: Uint8Array<ArrayBuffer> | null = null;
    let frame = 0;

    // Keep the canvas sharp on high-DPI screens.
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const draw = (time: number) => {
      const { width, height } = canvas;
      const mode = modeRef.current;
      const live = mode === "listening" || mode === "speaking";
      const analyser = live ? getAnalyserRef.current() : null;

      if (analyser) {
        if (!data || data.length !== analyser.frequencyBinCount) {
          data = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(data);
      }

      const dpr = window.devicePixelRatio || 1;
      const slot = width / BARS;
      const barWidth = Math.max(2 * dpr, slot * 0.5);
      const minHeight = 3 * dpr;
      const middle = (BARS - 1) / 2;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = getComputedStyle(canvas).color; // follows the light/dark theme

      for (let i = 0; i < BARS; i++) {
        // Distance from the center decides which frequency bin this bar shows.
        const distance = Math.abs(i - middle) / middle; // 0 at center, 1 at the edges
        let target = 0;
        if (analyser && data) {
          target = Math.min(1, (data[Math.floor(distance * USEFUL_BINS)] / 255) * 1.25);
        } else if (mode === "thinking") {
          // a gentle traveling wave while waiting for the model
          target = 0.12 + 0.1 * Math.sin(time / 260 - i * 0.45);
        }
        levels[i] += (target - levels[i]) * 0.3; // ease toward the target

        const barHeight = Math.max(minHeight, levels[i] * height * 0.95);
        const x = i * slot + (slot - barWidth) / 2;
        ctx.globalAlpha = live || mode === "thinking" ? 1 : 0.3;
        ctx.beginPath();
        ctx.roundRect(x, (height - barHeight) / 2, barWidth, barHeight, barWidth / 2);
        ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="visualizer" aria-hidden="true" />;
}
