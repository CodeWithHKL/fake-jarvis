"use client";

import { useEffect, useRef } from "react";

/**
 * Hand-drawn doodles scattered behind the landing page.
 *
 * - They drift slightly as the cursor moves (parallax) and dodge it when it gets close.
 * - Hovering one makes it wiggle.
 *
 * The drawings are plain SVG paths in a 64x64 box, stroked with the current text
 * color, so they follow the theme automatically.
 */

interface Doodle {
  /** SVG path data; each doodle is just one or more strokes. */
  path: string;
  /** Position of the doodle's center, as a percentage of the screen. */
  x: number;
  y: number;
  size: number; // px
  rotate: number; // degrees
  depth: number; // how strongly it reacts to the cursor (bigger = moves more)
}

const DOODLES: Doodle[] = [
  // star
  { path: "M32 7 L38 25 L57 26 L42 37 L47 56 L32 45 L16 56 L22 37 L7 26 L26 25 Z", x: 10, y: 17, size: 56, rotate: -12, depth: 1 },
  // squiggle
  { path: "M5 38 C11 20 18 20 22 34 S34 50 40 34 S52 20 59 31", x: 27, y: 10, size: 72, rotate: 8, depth: 0.6 },
  // spiral
  { path: "M32 32 C32 28 38 28 38 33 C38 41 26 41 26 31 C26 20 42 20 44 33 C46 47 24 50 20 32 C17 14 46 10 50 30", x: 7, y: 48, size: 60, rotate: 10, depth: 1.2 },
  // four-point sparkle
  { path: "M32 6 C34 24 40 30 58 32 C40 34 34 40 32 58 C30 40 24 34 6 32 C24 30 30 24 32 6 Z", x: 20, y: 73, size: 46, rotate: 0, depth: 0.8 },
  // heart
  { path: "M32 55 C9 38 7 22 20 16 C27 13 31 18 32 22 C33 18 37 13 44 16 C57 22 55 38 32 55 Z", x: 13, y: 89, size: 44, rotate: -10, depth: 1 },
  // cloud
  { path: "M17 47 C6 47 4 34 15 32 C13 19 30 15 36 25 C46 19 57 30 50 40 C59 42 57 49 48 49 Z", x: 85, y: 13, size: 76, rotate: 6, depth: 0.7 },
  // lightning bolt
  { path: "M37 5 L15 37 L30 37 L26 59 L49 26 L33 26 Z", x: 93, y: 38, size: 52, rotate: 14, depth: 1.1 },
  // music note
  { path: "M24 49 C24 55 13 55 13 49 C13 43 24 43 24 49 L24 14 L49 8 L49 41 C49 47 38 47 38 41 C38 35 49 35 49 41 M24 24 L49 18", x: 81, y: 62, size: 56, rotate: -8, depth: 0.9 },
  // smiley
  { path: "M32 8 C46 7 57 18 56 33 C55 47 43 57 30 56 C16 55 7 44 8 31 C9 18 19 9 32 8 M22 26 L22 31 M42 26 L42 31 M19 39 C26 49 38 49 45 39", x: 91, y: 84, size: 54, rotate: 10, depth: 1 },
  // curved arrow
  { path: "M9 52 C12 22 38 13 53 19 M43 8 L54 19 L41 27", x: 68, y: 90, size: 60, rotate: 0, depth: 0.6 },
  // scribbled circle
  { path: "M33 10 C49 8 59 26 51 42 C43 58 18 57 10 41 C4 27 14 12 35 12", x: 33, y: 90, size: 44, rotate: 0, depth: 1 },
  // sound wave
  { path: "M8 30 L8 34 M18 22 L18 42 M28 12 L28 52 M38 20 L38 44 M48 26 L48 38 M58 30 L58 34", x: 72, y: 10, size: 64, rotate: 0, depth: 0.8 },
  // plus
  { path: "M32 14 L32 50 M14 32 L50 32", x: 4, y: 29, size: 34, rotate: 15, depth: 1.3 },
  // tiny sparkle
  { path: "M32 8 C33 24 40 31 56 32 C40 33 33 40 32 56 C31 40 24 33 8 32 C24 31 31 24 32 8 Z", x: 95, y: 61, size: 30, rotate: 10, depth: 1.4 },
];

const REPEL_RADIUS = 180; // px: how close the cursor has to be before a doodle moves away
const REPEL_STRENGTH = 90; // px: how far a doodle gets pushed at most
const PARALLAX = 100; // px: how far the whole scene drifts with the cursor

export function DoodleBackground() {
  const layerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Cursor-driven motion. Positions are set straight on the DOM elements every frame
  // (not through React state), because re-rendering 60 times a second would be wasteful.
  // This runs even when the OS says "reduce motion": the movement only happens in
  // response to your own cursor. The automatic bobbing and wiggling are the parts
  // that get switched off in that case (see the reduced-motion rule in globals.css).
  useEffect(() => {
    const layer = layerRef.current!;
    const current = DOODLES.map(() => ({ x: 0, y: 0 })); // where each doodle is now
    let rect = layer.getBoundingClientRect();
    let mouse: { x: number; y: number } | null = null;
    let frame = 0;

    const measure = () => (rect = layer.getBoundingClientRect());
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") mouse = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => (mouse = null);

    const tick = () => {
      DOODLES.forEach((doodle, i) => {
        let targetX = 0;
        let targetY = 0;
        if (mouse) {
          // Parallax: the scene shifts opposite the cursor, and deeper doodles shift more.
          targetX = -((mouse.x - (rect.left + rect.width / 2)) / rect.width) * PARALLAX * doodle.depth;
          targetY = -((mouse.y - (rect.top + rect.height / 2)) / rect.height) * PARALLAX * doodle.depth;
          // Repel: push away from the cursor when it's close.
          const dx = rect.left + (doodle.x / 100) * rect.width - mouse.x;
          const dy = rect.top + (doodle.y / 100) * rect.height - mouse.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < REPEL_RADIUS) {
            const push = (1 - distance / REPEL_RADIUS) * REPEL_STRENGTH;
            targetX += (dx / distance) * push;
            targetY += (dy / distance) * push;
          }
        }
        // Ease toward the target instead of jumping, so it feels soft.
        current[i].x += (targetX - current[i].x) * 0.1;
        current[i].y += (targetY - current[i].y) * 0.1;
        const el = itemRefs.current[i];
        if (el) el.style.transform = `translate3d(${current[i].x}px, ${current[i].y}px, 0)`;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div className="doodles" ref={layerRef}>
      {DOODLES.map((d, i) => (
        <div
          key={i}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          className="doodle"
          aria-hidden="true"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: d.size,
            height: d.size,
            margin: `${-d.size / 2}px 0 0 ${-d.size / 2}px`, // so x/y mark the center
          }}
        >
          <div
            className="doodle-float"
            style={
              {
                "--r": `${d.rotate}deg`,
                "--dur": `${5 + (i % 4)}s`, // a little variety so they don't bob in unison
                "--delay": `${-i * 0.7}s`,
              } as React.CSSProperties
            }
          >
            <svg viewBox="0 0 64 64">
              <path d={d.path} />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}
