"use client";

import { useEffect, useRef } from "react";

/**
 * Hand-drawn tech and robotics doodles scattered behind the landing page.
 *
 * What they do:
 * - Drift slightly with the cursor (parallax) and dodge it when it gets close.
 * - The robot's eyes follow your cursor, and the gears turn as you move across the screen.
 * - Hovering a doodle makes it react (speeds up, lights up); clicking it pops.
 * - Slow ambient loops (spinning, signals, blinking) run unless the OS asks to reduce motion.
 *
 * Each doodle is plain SVG in a 64x64 box, stroked with the current text color, so it
 * follows the theme. The animations themselves live in globals.css, keyed on class names
 * like `spin`, `flow` and `arc`. Cursor-driven parts are marked with data attributes below.
 */

// ---------- gear drawing ----------

/** Build a gear outline: `teeth` trapezoid teeth around a center point. */
function gearPath(cx: number, cy: number, outer: number, inner: number, teeth: number, phase: number): string {
  const step = 360 / teeth;
  const point = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  };
  const points: string[] = [];
  for (let k = 0; k < teeth; k++) {
    const a = phase + k * step; // angle of this tooth's center
    points.push(point(a - step * 0.3, inner), point(a - step * 0.17, outer), point(a + step * 0.17, outer), point(a + step * 0.3, inner));
  }
  return `M${points.join(" L")} Z`;
}

// Two gears that mesh: the distance between centers is the sum of their pitch radii,
// and the phases are chosen so a tooth of one sits in a gap of the other.
const BIG = { x: 22, y: 24, teeth: 10 };
const SMALL = { x: 41, y: 39.9, teeth: 7 };
const BIG_GEAR = gearPath(BIG.x, BIG.y, 17, 13.5, BIG.teeth, 4);
const SMALL_GEAR = gearPath(SMALL.x, SMALL.y, 11, 8, SMALL.teeth, 40);

/** Make an element turn around a fixed point in the 64x64 box (instead of its own bounding box). */
const around = (x: number, y: number): React.CSSProperties => ({ transformBox: "view-box", transformOrigin: `${x}px ${y}px` });

// ---------- the doodles ----------

interface Doodle {
  /** What it looks like (the inside of the <svg>). */
  art: React.ReactNode;
  /** Center of the doodle as a percentage of the screen. */
  x: number;
  y: number;
  size: number; // px
  rotate: number; // degrees
  depth: number; // how strongly it reacts to the cursor (bigger = moves more)
  /** No animation of its own: just wiggle on hover. */
  plain?: boolean;
}

const DOODLES: Doodle[] = [
  // Robot head. The pupils follow the cursor; the antenna light blinks.
  {
    x: 12, y: 24, size: 96, rotate: -6, depth: 1,
    art: (
      <>
        <path d="M32 14 L32 7" />
        <circle className="solid anim blink" cx="32" cy="5" r="2.8" />
        <path d="M14 19 C14 15.5 17 14 20 14 L44 14 C47 14 50 15.5 50 19 L50 44 C50 47.5 47 49 44 49 L20 49 C17 49 14 47.5 14 44 Z" />
        <path d="M10 28 L10 38 M54 28 L54 38" />
        <circle cx="24" cy="30" r="6.5" />
        <circle cx="40" cy="30" r="6.5" />
        <g data-pupils>
          <circle className="solid" cx="24" cy="30" r="2.6" />
          <circle className="solid" cx="40" cy="30" r="2.6" />
        </g>
        <path d="M23 42 L41 42 M28 40 L28 44 M32 40 L32 44 M36 40 L36 44" />
        <path d="M27 49 L27 55 M37 49 L37 55 M21 56 L43 56" />
      </>
    ),
  },
  // Two meshed gears. They turn as the cursor moves across the screen (the big one clockwise,
  // the small one the other way and faster, like real gears), and spin up on hover.
  {
    x: 88, y: 22, size: 112, rotate: 0, depth: 0.8,
    art: (
      <>
        <g data-spin="1" style={around(BIG.x, BIG.y)}>
          <g className="anim spin" style={around(BIG.x, BIG.y)}>
            <path d={BIG_GEAR} />
            <circle cx={BIG.x} cy={BIG.y} r="5" />
          </g>
        </g>
        <g data-spin="-1.43" style={around(SMALL.x, SMALL.y)}>
          <g className="anim spin rev fast" style={around(SMALL.x, SMALL.y)}>
            <path d={SMALL_GEAR} />
            <circle cx={SMALL.x} cy={SMALL.y} r="3.5" />
          </g>
        </g>
      </>
    ),
  },
  // Circuit trace with a signal running along it.
  {
    x: 27, y: 10, size: 88, rotate: 0, depth: 0.6,
    art: (
      <>
        <path className="faint" d="M4 50 L18 50 L26 38 L40 38 L46 28 L60 28" />
        <path className="anim flow" strokeDasharray="2 10" d="M4 50 L18 50 L26 38 L40 38 L46 28 L60 28" />
        <path className="faint" d="M26 38 L26 54 L36 54" />
        <circle cx="4" cy="50" r="3" />
        <circle cx="60" cy="28" r="3" />
        <circle cx="36" cy="54" r="2.5" />
      </>
    ),
  },
  // Chip. The core pulses.
  {
    x: 7, y: 56, size: 66, rotate: 8, depth: 1.2,
    art: (
      <>
        <path d="M16 16 L48 16 L48 48 L16 48 Z" />
        <path className="anim core" d="M25 25 L39 25 L39 39 L25 39 Z" />
        <path d="M16 24 L9 24 M16 32 L9 32 M16 40 L9 40 M48 24 L55 24 M48 32 L55 32 M48 40 L55 40" />
        <path d="M24 16 L24 9 M32 16 L32 9 M40 16 L40 9 M24 48 L24 55 M32 48 L32 55 M40 48 L40 55" />
      </>
    ),
  },
  // Wi-Fi signal: arcs light up one after another.
  {
    x: 20, y: 78, size: 54, rotate: 0, depth: 0.8,
    art: (
      <>
        <path className="anim arc" style={{ "--i": 2 } as React.CSSProperties} d="M10 26 Q32 6 54 26" />
        <path className="anim arc" style={{ "--i": 1 } as React.CSSProperties} d="M18 34 Q32 21 46 34" />
        <path className="anim arc" style={{ "--i": 0 } as React.CSSProperties} d="M26 42 Q32 36 38 42" />
        <circle className="solid" cx="32" cy="50" r="3" />
      </>
    ),
  },
  // Radar with a sweeping line.
  {
    x: 11, y: 91, size: 60, rotate: 0, depth: 1,
    art: (
      <>
        <circle cx="32" cy="32" r="24" />
        <circle className="faint" cx="32" cy="32" r="14" />
        <path className="faint" d="M32 8 L32 56 M8 32 L56 32" />
        <g className="anim sweep" style={around(32, 32)}>
          <path d="M32 32 L32 8" />
        </g>
        <circle className="solid" cx="44" cy="22" r="2.2" />
      </>
    ),
  },
  // Atom: three orbits spinning around a nucleus.
  {
    x: 78, y: 90, size: 70, rotate: 0, depth: 0.9,
    art: (
      <>
        <circle className="solid" cx="32" cy="32" r="3.2" />
        <g className="anim orbit" style={around(32, 32)}>
          <ellipse cx="32" cy="32" rx="25" ry="9" />
          <circle className="solid" cx="57" cy="32" r="2.2" />
          <g transform="rotate(60 32 32)">
            <ellipse cx="32" cy="32" rx="25" ry="9" />
            <circle className="solid" cx="57" cy="32" r="2.2" />
          </g>
          <g transform="rotate(120 32 32)">
            <ellipse cx="32" cy="32" rx="25" ry="9" />
            <circle className="solid" cx="57" cy="32" r="2.2" />
          </g>
        </g>
      </>
    ),
  },
  // Terminal window with a blinking cursor.
  {
    x: 50, y: 8, size: 70, rotate: 0, depth: 0.7,
    art: (
      <>
        <path d="M6 12 L58 12 L58 52 L6 52 Z" />
        <path d="M6 20 L58 20" />
        <circle className="solid" cx="12" cy="16" r="1.4" />
        <circle className="solid" cx="17" cy="16" r="1.4" />
        <path d="M16 28 L26 34 L16 40" />
        <path className="anim blink" d="M32 41 L44 41" />
      </>
    ),
  },
  // Sound wave (it's a voice assistant): bars bounce.
  {
    x: 70, y: 12, size: 64, rotate: 0, depth: 0.8,
    art: (
      <>
        {[
          [8, 26, 38], [18, 18, 46], [28, 8, 56], [38, 16, 48], [48, 24, 40], [58, 28, 36],
        ].map(([x, y1, y2], i) => (
          <path key={x} className="anim bar" style={{ "--i": i } as React.CSSProperties} d={`M${x} ${y1} L${x} ${y2}`} />
        ))}
      </>
    ),
  },
  // Code brackets lean apart on hover.
  {
    x: 93, y: 57, size: 60, rotate: 0, depth: 1,
    art: (
      <>
        <path className="lb" d="M22 18 L8 32 L22 46" />
        <path className="rb" d="M42 18 L56 32 L42 46" />
        <path d="M36 14 L28 50" />
      </>
    ),
  },
  // Battery that keeps charging.
  {
    x: 84, y: 76, size: 58, rotate: -8, depth: 0.9,
    art: (
      <>
        <path d="M8 20 L50 20 L50 44 L8 44 Z" />
        <path d="M50 28 L56 28 L56 36 L50 36" />
        {[15, 23, 31, 39].map((x, i) => (
          <path key={x} className="anim charge" style={{ "--i": i } as React.CSSProperties} d={`M${x} 27 L${x} 37`} />
        ))}
      </>
    ),
  },
  // Lightning bolt.
  {
    x: 96, y: 42, size: 46, rotate: 14, depth: 1.1, plain: true,
    art: <path d="M37 5 L15 37 L30 37 L26 59 L49 26 L33 26 Z" />,
  },
  // AI sparkles that twinkle.
  {
    x: 33, y: 92, size: 44, rotate: 0, depth: 0.8,
    art: <path className="anim twinkle" d="M32 6 C34 24 40 30 58 32 C40 34 34 40 32 58 C30 40 24 34 6 32 C24 30 30 24 32 6 Z" />,
  },
  {
    x: 96, y: 68, size: 28, rotate: 10, depth: 1.4,
    art: <path className="anim twinkle" d="M32 6 C34 24 40 30 58 32 C40 34 34 40 32 58 C30 40 24 34 6 32 C24 30 30 24 32 6 Z" />,
  },
  // Small plus and a power button for texture.
  { x: 4, y: 34, size: 32, rotate: 15, depth: 1.3, plain: true, art: <path d="M32 14 L32 50 M14 32 L50 32" /> },
  {
    x: 63, y: 83, size: 40, rotate: 0, depth: 1, plain: true,
    art: <path d="M32 8 L32 30 M20 16 C10 24 10 42 22 50 C30 56 42 54 48 46 C54 38 52 24 44 16" />,
  },
];

// ---------- motion ----------

const REPEL_RADIUS = 170; // px: how close the cursor has to be before a doodle leans away
const REPEL_STRENGTH = 40; // px: how far a doodle gets pushed at most
const PARALLAX = 100; // px: how far the whole scene drifts with the cursor
const GEAR_TURNS = 540; // degrees the gears turn between the left and right edge of the screen
const EYE_REACH = 3.2; // how far the robot's pupils can move (in SVG units)

export function DoodleBackground() {
  const layerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Cursor-driven motion. Positions are set straight on the DOM elements every frame
  // (not through React state), because re-rendering 60 times a second would be wasteful.
  // This runs even when the OS says "reduce motion": it only happens in response to
  // your own cursor. The automatic loops are what get switched off in that case (globals.css).
  useEffect(() => {
    const layer = layerRef.current!;
    const items = itemRefs.current;
    const current = DOODLES.map(() => ({ x: 0, y: 0 })); // where each doodle is now
    const eyes = DOODLES.map(() => ({ x: 0, y: 0 })); // where each robot pupil is now
    // Find the parts JavaScript controls once, instead of searching every frame.
    const gears = items.map((el) => Array.from(el?.querySelectorAll<SVGGElement>("[data-spin]") ?? []));
    const pupils = items.map((el) => el?.querySelector<SVGGElement>("[data-pupils]") ?? null);

    let rect = layer.getBoundingClientRect();
    let mouse: { x: number; y: number } | null = null;
    let gearAngle = 0;
    let frame = 0;

    const measure = () => (rect = layer.getBoundingClientRect());
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") mouse = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => (mouse = null);

    const tick = () => {
      // Gears: the angle follows how far across the screen the cursor is.
      const gearTarget = mouse ? (mouse.x / window.innerWidth) * GEAR_TURNS : gearAngle;
      gearAngle += (gearTarget - gearAngle) * 0.08;

      DOODLES.forEach((doodle, i) => {
        const centerX = rect.left + (doodle.x / 100) * rect.width;
        const centerY = rect.top + (doodle.y / 100) * rect.height;

        let targetX = 0;
        let targetY = 0;
        if (mouse) {
          // Parallax: the scene shifts opposite the cursor, and deeper doodles shift more.
          targetX = -((mouse.x - (rect.left + rect.width / 2)) / rect.width) * PARALLAX * doodle.depth;
          targetY = -((mouse.y - (rect.top + rect.height / 2)) / rect.height) * PARALLAX * doodle.depth;
          // Shy nudge: lean away from the cursor as it approaches. There is no push at all
          // once the cursor is over the doodle itself (inside `inner`), and the push fades in
          // gradually beyond that, so you can always catch a doodle to hover or click it.
          const dx = centerX - mouse.x;
          const dy = centerY - mouse.y;
          const distance = Math.hypot(dx, dy);
          const inner = doodle.size * 0.6;
          if (distance > inner && distance < REPEL_RADIUS) {
            const t = (distance - inner) / (REPEL_RADIUS - inner);
            const push = 4 * t * (1 - t) * REPEL_STRENGTH;
            targetX += (dx / distance) * push;
            targetY += (dy / distance) * push;
          }
        }
        // Ease toward the target instead of jumping, so it feels soft.
        current[i].x += (targetX - current[i].x) * 0.1;
        current[i].y += (targetY - current[i].y) * 0.1;
        const el = items[i];
        if (el) el.style.transform = `translate3d(${current[i].x}px, ${current[i].y}px, 0)`;

        for (const gear of gears[i]) gear.style.transform = `rotate(${gearAngle * Number(gear.dataset.spin)}deg)`;

        const pupil = pupils[i];
        if (pupil) {
          // Look toward the cursor (measured from where the robot currently is); rest when it leaves.
          let lookX = 0;
          let lookY = 0;
          if (mouse) {
            const dx = mouse.x - (centerX + current[i].x);
            const dy = mouse.y - (centerY + current[i].y);
            const distance = Math.hypot(dx, dy) || 1;
            const reach = Math.min(distance / 150, 1) * EYE_REACH;
            lookX = (dx / distance) * reach;
            lookY = (dy / distance) * reach;
          }
          eyes[i].x += (lookX - eyes[i].x) * 0.2;
          eyes[i].y += (lookY - eyes[i].y) * 0.2;
          pupil.style.transform = `translate(${eyes[i].x}px, ${eyes[i].y}px)`;
        }
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", measure);
    };
  }, []);

  /** Click: restart the squash-and-stretch animation on this doodle. */
  function pop(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.currentTarget.querySelector<HTMLElement>(".doodle-pop");
    if (!target) return;
    target.classList.remove("pop");
    void target.offsetWidth; // forces the browser to notice, so the animation can restart
    target.classList.add("pop");
  }

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
          style={
            {
              left: `${d.x}%`,
              top: `${d.y}%`,
              width: d.size,
              height: d.size,
              margin: `${-d.size / 2}px 0 0 ${-d.size / 2}px`, // so x/y mark the center
              "--appear": `${i * 70}ms`, // they fade in one after another
            } as React.CSSProperties
          }
        >
          <div
            className={`doodle-float${d.plain ? " plain" : ""}`}
            onClick={pop}
            style={
              {
                "--r": `${d.rotate}deg`,
                "--dur": `${5 + (i % 4)}s`, // a little variety so they don't bob in unison
                "--delay": `${-i * 0.7}s`,
              } as React.CSSProperties
            }
          >
            <div className="doodle-pop">
              <svg viewBox="0 0 64 64">{d.art}</svg>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
