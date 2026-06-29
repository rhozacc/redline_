import React, { useRef, useEffect, useState, useCallback } from "react";
import { C, MONO, SANS, DISPLAY, CTX_SNAP_POINTS, CTX_SNAP_RADIUS } from "./constants.js";

/* ------------------------------------------------------------------ */
/*  Panel                                                              */
/* ------------------------------------------------------------------ */
export function Panel({ children, style, className }) {
  return (
    <div
      className={className}
      style={{
        background: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AnimatedNumber — smoothly transitions numeric display             */
/* ------------------------------------------------------------------ */
export function AnimatedNumber({ value, fmt }) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const fromRef = useRef(value);
  const toRef = useRef(value);
  const DURATION = 220;

  useEffect(() => {
    fromRef.current = display;
    toRef.current = value;
    cancelAnimationFrame(rafRef.current);
    startRef.current = null;

    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / DURATION);
      const ease = 1 - Math.pow(1 - t, 3);
      const v = fromRef.current + (toRef.current - fromRef.current) * ease;
      setDisplay(v);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{fmt(display)}</>;
}

/* ------------------------------------------------------------------ */
/*  Slider with snap                                                   */
/* ------------------------------------------------------------------ */
export function Slider({ label, unit, value, min, max, step, onChange, accent, fmt, snapPoints, log }) {
  const [snapping, setSnapping] = useState(false);
  const snapTimerRef = useRef(null);

  // Map real value <-> normalized 0..1 track position. Snap distances are
  // measured in position space so they feel uniform on both scales.
  const toPos = useCallback((v) =>
    log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min),
  [log, min, max]);
  const fromPos = useCallback((p) =>
    log ? min * Math.pow(max / min, p) : min + p * (max - min),
  [log, min, max]);

  const handleChange = useCallback((e) => {
    let v;
    if (log) {
      v = fromPos(parseFloat(e.target.value));
      // round to a clean granularity that scales with magnitude
      const gran = v >= 65536 ? 1024 : v >= 8192 ? 256 : v >= 1024 ? 64 : 16;
      v = Math.min(max, Math.max(min, Math.round(v / gran) * gran));
    } else {
      v = parseFloat(e.target.value);
    }
    if (snapPoints) {
      const vPos = toPos(v);
      const nearest = snapPoints.reduce((a, b) =>
        Math.abs(toPos(b) - vPos) < Math.abs(toPos(a) - vPos) ? b : a
      );
      if (Math.abs(toPos(nearest) - vPos) < CTX_SNAP_RADIUS && nearest >= min && nearest <= max) {
        if (v !== nearest) {
          setSnapping(true);
          clearTimeout(snapTimerRef.current);
          snapTimerRef.current = setTimeout(() => setSnapping(false), 400);
        }
        v = nearest;
      }
    }
    onChange(v);
  }, [onChange, snapPoints, min, max, log, fromPos, toPos]);

  const pct = toPos(value) * 100;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 11.5, color: C.muted, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase" }}>
          {label}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 16, color: C.text }}>
          {fmt(value)}{" "}
          <span style={{ fontSize: 11, color: C.faint }}>{unit}</span>
        </span>
      </div>
      <div style={{ position: "relative" }}>
        <input
          type="range"
          min={log ? 0 : min}
          max={log ? 1 : max}
          step={log ? 0.0001 : step}
          value={log ? toPos(value) : value}
          onChange={handleChange}
          className={snapping ? "snap-pulse" : ""}
          style={{
            width: "100%",
            accentColor: accent,
            cursor: "pointer",
            height: 4,
            background: `linear-gradient(to right, ${accent} ${pct}%, ${C.line} ${pct}%)`,
            borderRadius: 4,
          }}
        />
        {/* snap point ticks */}
        {snapPoints && (
          <div style={{ position: "absolute", top: 18, left: 0, right: 0, display: "flex", pointerEvents: "none" }}>
            {snapPoints
              .filter(p => p >= min && p <= max)
              .map(p => {
                const pos = toPos(p) * 100;
                const isNear = Math.abs(toPos(p) - toPos(value)) < CTX_SNAP_RADIUS * 2;
                return (
                  <div
                    key={p}
                    style={{
                      position: "absolute",
                      left: `${pos}%`,
                      transform: "translateX(-50%)",
                      width: isNear ? 2 : 1,
                      height: isNear ? 6 : 4,
                      background: isNear ? accent : C.faint,
                      borderRadius: 1,
                      transition: "all 0.15s ease",
                      opacity: isNear ? 1 : 0.5,
                    }}
                  />
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NumberInput                                                        */
/* ------------------------------------------------------------------ */
export function NumberInput({ value, onChange, step, min, max }) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      min={min}
      max={max}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
      }}
      style={{
        fontFamily: MONO,
        fontSize: 13,
        width: 58,
        textAlign: "right",
        background: C.panel2,
        border: `1px solid ${C.line}`,
        borderRadius: 5,
        color: C.text,
        padding: "3px 6px",
        outline: "none",
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  GeoField                                                           */
/* ------------------------------------------------------------------ */
export function GeoField({ label, value, onChange }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: C.faint,
          fontFamily: MONO,
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
      <input
        type="number"
        value={value}
        min={1}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          if (!isNaN(v) && v > 0) onChange(v);
        }}
        style={{
          fontFamily: MONO,
          fontSize: 14,
          width: "100%",
          textAlign: "center",
          background: C.panel2,
          border: `1px solid ${C.line}`,
          borderRadius: 6,
          color: C.text,
          padding: "6px 0",
          outline: "none",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Row                                                                */
/* ------------------------------------------------------------------ */
export function Row({ label, hint, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 0",
      }}
    >
      <div>
        <div style={{ fontSize: 12.5, color: C.text }}>{label}</div>
        <div style={{ fontSize: 10.5, color: C.faint }}>{hint}</div>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 12.5, color: C.muted, whiteSpace: "nowrap" }}>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Gauge — animated bar                                               */
/* ------------------------------------------------------------------ */
export function Gauge({ label, total, ceiling, scaleMax, segs }) {
  const pct = (v) => `${Math.min(100, (v / scaleMax) * 100)}%`;
  const ceilingLeft = `${Math.min(100, (ceiling / scaleMax) * 100)}%`;
  const over = total > ceiling;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{label}</span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 13,
            color: over ? C.oom : C.text,
            transition: "color 0.3s ease",
          }}
        >
          <AnimatedNumber value={total} fmt={(v) => (v < 10 ? v.toFixed(2) : v.toFixed(1))} /> GB
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 26,
          borderRadius: 6,
          background: C.panel2,
          border: `1px solid ${over ? C.oom : C.line}`,
          overflow: "hidden",
          display: "flex",
          transition: "border-color 0.3s ease",
        }}
      >
        {segs.map((s, i) => (
          <div
            key={i}
            style={{
              width: pct(s.w),
              height: "100%",
              background: s.color,
              backgroundImage: s.hatch
                ? `repeating-linear-gradient(45deg, ${s.color} 0 5px, #8a4d20 5px 10px)`
                : "none",
              transition: "width 0.28s cubic-bezier(0.4,0,0.2,1)",
              flexShrink: 0,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            top: -2,
            bottom: -2,
            left: ceilingLeft,
            width: 2,
            background: C.ceiling,
            boxShadow: `0 0 6px ${over ? C.oom : C.ceiling}`,
            transition: "left 0.28s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s",
          }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StackBar — borderless segmented bar with a redline tick           */
/* ------------------------------------------------------------------ */
export function StackBar({ label, total, segs, ceiling, scaleMax, alert }) {
  const pct = (v) => `${Math.min(100, (v / scaleMax) * 100)}%`;
  const ceilLeft = `${Math.min(100, (ceiling / scaleMax) * 100)}%`;
  const over = total > ceiling;
  const flash = alert && over;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.muted, letterSpacing: 0.5 }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: over ? C.oom : C.text, transition: "color 0.3s" }}>
          <AnimatedNumber value={total} fmt={(v) => (v < 10 ? v.toFixed(2) : v.toFixed(1))} /> GB
        </span>
      </div>
      <div className={flash ? "prefill-alert" : undefined} style={{ position: "relative", height: 9, display: "flex", borderRadius: 99, overflow: "hidden", background: C.panel2, transformOrigin: "center" }}>
        {segs.map((s, i) => (
          <div key={i} style={{
            width: pct(s.w), height: "100%", background: s.color, flexShrink: 0,
            backgroundImage: s.hatch ? `repeating-linear-gradient(45deg, ${s.color} 0 4px, #8a4d20 4px 8px)` : "none",
            transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
          }} />
        ))}
        <div style={{
          position: "absolute", top: -3, bottom: -3, left: ceilLeft, width: 2,
          background: over ? C.oom : C.ceiling, boxShadow: `0 0 6px ${over ? C.oom : C.ceiling}`,
          transition: "left 0.3s cubic-bezier(0.4,0,0.2,1), background 0.3s",
        }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BigReadout — borderless stat, large display numeral               */
/* ------------------------------------------------------------------ */
export function BigReadout({ label, value, unit, ok, sub, accent }) {
  const col = ok ? (accent || C.text) : C.oom;
  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, fontFamily: MONO, letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 600, color: col, lineHeight: 1, letterSpacing: -0.5, transition: "color 0.3s ease" }}>
        {value}
        <span style={{ fontSize: 12, color: C.faint, marginLeft: 4, fontWeight: 400, fontFamily: MONO }}>{unit}</span>
      </div>
      <div style={{ fontSize: 10.5, color: ok ? C.faint : C.oom, marginTop: 6, transition: "color 0.3s ease" }}>
        {sub}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SectionTag — numbered datasheet section header                    */
/*  glitch=true adds the RGB-split animation (same technique as Title) */
/* ------------------------------------------------------------------ */
export function SectionTag({ n, children, accent, glitch, label }) {
  const redRef = useRef(null);
  const cyanRef = useRef(null);

  useEffect(() => {
    if (!glitch) return;
    const red = redRef.current;
    const cyan = cyanRef.current;
    if (!red || !cyan) return;

    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      red.style.cssText += ";opacity:.4;transform:translate(-1.5px,0)";
      cyan.style.cssText += ";opacity:.4;transform:translate(1.5px,0)";
      return;
    }

    const rnd = (a, b) => a + Math.random() * (b - a);
    const slice = () => {
      const top = rnd(0, 78), bot = rnd(0, 96 - top);
      return `inset(${top.toFixed(1)}% 0 ${bot.toFixed(1)}% 0)`;
    };
    const clean = (el) => { el.style.opacity = "0"; el.style.transform = "none"; el.style.clipPath = "none"; };
    const chaos = (el, amp) => {
      el.style.opacity = Math.random() < 0.82 ? "1" : "0";
      el.style.transform = `translate(${rnd(-amp, amp).toFixed(1)}px, ${rnd(-2, 2).toFixed(1)}px)`;
      el.style.clipPath = slice();
    };

    let burstEnd = 0, frameTimer = null, nextTimer = null, raf = null, alive = true;

    const tick = () => {
      if (!alive) return;
      if (performance.now() < burstEnd) {
        const amp = rnd(3, 8);
        chaos(red, amp); chaos(cyan, amp);
        frameTimer = setTimeout(() => { raf = requestAnimationFrame(tick); }, rnd(16, 50));
      } else { clean(red); clean(cyan); }
    };

    const schedule = () => {
      if (!alive) return;
      nextTimer = setTimeout(() => {
        const dur = Math.random() < 0.34 ? rnd(600, 1200) : rnd(200, 480);
        burstEnd = performance.now() + dur;
        raf = requestAnimationFrame(tick);
        schedule();
      }, rnd(900, 1900));
    };

    // fire immediately on mount so the alarm is obvious right away
    burstEnd = performance.now() + rnd(250, 500);
    raf = requestAnimationFrame(tick);
    schedule();

    return () => {
      alive = false;
      clearTimeout(nextTimer); clearTimeout(frameTimer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [glitch]);

  // text used for glitch overlay layers — plain string only (no React nodes)
  const glitchText = label ?? (typeof children === "string" ? children : null);

  const layerStyle = {
    position: "absolute", left: 0, top: 0,
    fontFamily: DISPLAY, fontSize: 21, fontWeight: 700, letterSpacing: 0.3,
    opacity: 0, mixBlendMode: "screen",
    pointerEvents: "none", whiteSpace: "nowrap",
    willChange: "transform, clip-path, opacity",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 700, color: C.text, letterSpacing: 0.3 }}>
          {children}
        </span>
        {glitch && glitchText && (
          <>
            <span ref={redRef} aria-hidden="true" style={{ ...layerStyle, color: "#D23B3B" }}>{glitchText}</span>
            <span ref={cyanRef} aria-hidden="true" style={{ ...layerStyle, color: "#2AD4D4" }}>{glitchText}</span>
          </>
        )}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Key                                                                */
/* ------------------------------------------------------------------ */
export function Key({ color, label, v, hatch }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: color,
          backgroundImage: hatch
            ? `repeating-linear-gradient(45deg, ${color} 0 3px, #8a4d20 3px 6px)`
            : "none",
        }}
      />
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ color: C.text }}>
        <AnimatedNumber value={v} fmt={(n) => (n < 10 ? n.toFixed(2) : n.toFixed(1))} />
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                          */
/* ------------------------------------------------------------------ */
export function Stat({ label, value, unit, ok, sub, accent }) {
  const col = ok ? (accent || C.text) : C.oom;
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${ok ? C.line : C.oom + "44"}`,
        borderRadius: 12,
        padding: "14px 16px",
        transition: "border-color 0.3s ease",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          color: C.muted,
          fontFamily: MONO,
          letterSpacing: 0.5,
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 26,
          fontWeight: 700,
          color: col,
          lineHeight: 1,
          transition: "color 0.3s ease",
        }}
      >
        {value}
        <span style={{ fontSize: 12, color: C.faint, marginLeft: 4, fontWeight: 400 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11, color: ok ? C.faint : C.oom, marginTop: 6, transition: "color 0.3s ease" }}>
        {sub}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tooltip for chart                                                  */
/* ------------------------------------------------------------------ */
const ktok = (n) =>
  n >= 1000000 ? (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace(/\.0$/, "") + "M"
  : n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k"
  : String(Math.round(n));
const gb = (n) => (n < 10 ? n.toFixed(2) : n.toFixed(1));

export function TipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#0E1116",
        border: `1px solid ${C.line}`,
        borderRadius: 8,
        padding: "8px 10px",
        fontFamily: MONO,
        fontSize: 11.5,
      }}
    >
      <div style={{ color: C.muted, marginBottom: 4 }}>{ktok(label)} tokens</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {gb(p.value)} GB
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Spinner                                                            */
/* ------------------------------------------------------------------ */
export function Spinner({ size = 14, color = C.muted }) {
  return (
    <svg
      className="spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  HF Model Search                                                    */
/* ------------------------------------------------------------------ */
export function HFSearch({ hf, onApply }) {
  const [open, setOpen] = useState(false);
  const [applyingId, setApplyingId] = useState(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleApply = async (modelId) => {
    setApplyingId(modelId);
    setOpen(false);
    const data = await hf.fetchConfig(modelId);
    setApplyingId(null);
    if (data) onApply(data);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1, minWidth: 200 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: C.panel2,
          border: `1px solid ${open ? C.weights : C.line}`,
          borderRadius: 8,
          padding: "7px 10px",
          transition: "border-color 0.15s",
        }}
      >
        {/* search icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          ref={inputRef}
          placeholder="Search HuggingFace models…"
          value={hf.query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { hf.search(e.target.value); setOpen(true); }}
          style={{
            flex: 1,
            background: "none",
            border: "none",
            outline: "none",
            fontFamily: MONO,
            fontSize: 12.5,
            color: C.text,
          }}
        />
        {/* restrict search to the mlx-community org */}
        <button
          type="button"
          onClick={() => hf.setMlxOnly(!hf.mlxOnly)}
          title="Only show models from the mlx-community org on HuggingFace"
          style={{
            flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5,
            fontFamily: MONO, fontSize: 10.5, letterSpacing: 0.5,
            padding: "3px 8px", borderRadius: 999, cursor: "pointer",
            border: `1px solid ${hf.mlxOnly ? C.kv : C.line}`,
            background: hf.mlxOnly ? "rgba(201,148,46,0.16)" : "transparent",
            color: hf.mlxOnly ? C.kv : C.faint,
            transition: "border-color 0.15s, background 0.15s, color 0.15s",
          }}
        >
          <span style={{
            width: 8, height: 8, borderRadius: 2, flexShrink: 0,
            background: hf.mlxOnly ? C.kv : "transparent",
            border: `1px solid ${hf.mlxOnly ? C.kv : C.faint}`,
          }} />
          mlx only
        </button>
        {hf.loading && <Spinner size={13} />}
        {(hf.applying || applyingId) && <Spinner size={13} color={C.kv} />}
      </div>

      {open && (hf.results.length > 0 || hf.error) && (
        <div
          className="fade-slide-in"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: C.panel,
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            overflow: "hidden",
            zIndex: 100,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          {hf.error && (
            <div style={{ padding: "10px 12px", fontSize: 12, color: C.oom, fontFamily: MONO }}>
              {hf.error}
            </div>
          )}
          {hf.results.map((r, i) => (
            <button
              key={r.modelId}
              onClick={() => handleApply(r.modelId)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "9px 12px",
                background: applyingId === r.modelId ? `${C.weights}18` : "transparent",
                border: "none",
                borderTop: i > 0 ? `1px solid ${C.line}` : "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = `${C.weights}12`}
              onMouseLeave={(e) => e.currentTarget.style.background = applyingId === r.modelId ? `${C.weights}18` : "transparent"}
            >
              <div>
                <div style={{ fontFamily: MONO, fontSize: 12.5, color: C.text }}>{r.modelId}</div>
                <div style={{ fontSize: 10.5, color: C.faint, marginTop: 2 }}>
                  {r.tags?.filter(t => ["text-generation", "transformers", "gguf", "mlx"].includes(t)).slice(0, 3).join(" · ")}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                {r.downloads != null && (
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>
                    ↓ {r.downloads >= 1000 ? (r.downloads / 1000).toFixed(0) + "k" : r.downloads}
                  </div>
                )}
                {r.likes != null && (
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>
                    ♥ {r.likes}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
