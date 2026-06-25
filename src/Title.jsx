import React, { useRef, useEffect } from "react";
import { DISPLAY } from "./constants.js";
import { glitchBus } from "./glitchBus.js";

/* REDLINE wordmark: plain white most of the time, with a fast, chaotic
 * RGB-split glitch burst roughly every 5s. The burst is JS-driven (not a CSS
 * keyframe loop) so every frame and every burst is genuinely random — and so it
 * truly *appears*, rather than shimmering continuously. Static split under
 * prefers-reduced-motion. */
export default function Title({ fontSize = 64 }) {
  const redRef = useRef(null);
  const cyanRef = useRef(null);

  useEffect(() => {
    const red = redRef.current;
    const cyan = cyanRef.current;
    if (!red || !cyan) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      // no motion — freeze to a faint static chromatic split
      red.style.cssText += ";opacity:.5;transform:translate(-2px,0)";
      cyan.style.cssText += ";opacity:.5;transform:translate(2px,0)";
      return;
    }

    const rnd = (a, b) => a + Math.random() * (b - a);
    const slice = () => {
      const top = rnd(0, 78);
      const bot = rnd(0, 96 - top);
      return `inset(${top.toFixed(1)}% 0 ${bot.toFixed(1)}% 0)`;
    };
    const clean = (el) => {
      el.style.opacity = "0";
      el.style.transform = "none";
      el.style.clipPath = "none";
    };
    const chaos = (el, amp) => {
      el.style.opacity = Math.random() < 0.82 ? "1" : "0"; // random dropouts
      el.style.transform = `translate(${rnd(-amp, amp).toFixed(1)}px, ${rnd(-3, 3).toFixed(1)}px)`;
      el.style.clipPath = slice();
    };

    let burstEnd = 0;
    let frameTimer = null;
    let nextTimer = null;
    let raf = null;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      if (performance.now() < burstEnd) {
        const amp = rnd(4, 11);
        chaos(red, amp);
        chaos(cyan, amp);
        // irregular gap between frames → jittery, "much faster" feel
        frameTimer = setTimeout(() => { raf = requestAnimationFrame(tick); }, rnd(16, 50));
      } else {
        clean(red);
        clean(cyan);
      }
    };

    const schedule = () => {
      if (!alive) return;
      nextTimer = setTimeout(() => {
        // mostly short snappy bursts, but ~1 in 3 runs noticeably longer
        const long = Math.random() < 0.34;
        const dur = long ? rnd(650, 1300) : rnd(220, 520);
        burstEnd = performance.now() + dur;
        glitchBus.emit(dur); // particles glitch in sync
        raf = requestAnimationFrame(tick);
        schedule();
      }, rnd(1500, 2500)); // random 1.5–2.5s gap (2× more often), never metronomic
    };
    schedule();

    return () => {
      alive = false;
      clearTimeout(nextTimer);
      clearTimeout(frameTimer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const layer = (color) => ({
    position: "absolute",
    left: 0,
    top: 0,
    margin: 0,
    fontFamily: DISPLAY,
    fontWeight: 700,
    fontSize,
    letterSpacing: 1,
    lineHeight: 0.9,
    color,
    opacity: 0,
    mixBlendMode: "screen",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    willChange: "transform, clip-path, opacity",
  });

  return (
    <div style={{ position: "relative", display: "inline-block", zIndex: 1 }}>
      <h1
        style={{
          position: "relative", zIndex: 1, margin: 0,
          fontFamily: DISPLAY, fontWeight: 700, fontSize,
          letterSpacing: 1, lineHeight: 0.9, color: "#fff",
        }}
      >
        REDLINE
      </h1>
      <span ref={redRef} aria-hidden="true" style={layer("#D23B3B")}>REDLINE</span>
      <span ref={cyanRef} aria-hidden="true" style={layer("#2AD4D4")}>REDLINE</span>
    </div>
  );
}
