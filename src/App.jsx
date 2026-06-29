import React, { useState, useMemo } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, ReferenceLine, ReferenceArea,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { C, MONO, SANS, DISPLAY, QUANT, KVQUANT, RAM_OPTIONS, MAC_SPECS, MAC_SPECS_META, PREFILL_EFF, CTX_SNAP_POINTS, PRESETS } from "./constants.js";
import {
  Slider, NumberInput, GeoField, Row, Key, TipBox, HFSearch,
  StackBar, BigReadout, SectionTag,
} from "./components.jsx";
import useHFModel from "./useHFModel.js";
import useMediaQuery from "./useMediaQuery.js";
import Background from "./Background.jsx";
import Surface from "./Surface.jsx";
import Title from "./Title.jsx";
import ExplainerPage from "./ExplainerPage.jsx";
import { ExplainerProvider, InfoDot } from "./Explainer.jsx";

/* ------------------------------------------------------------------ */
const gb  = (n) => (n < 10 ? n.toFixed(2) : n.toFixed(1));
const ktok = (n) =>
  n >= 1000000 ? (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace(/\.0$/, "") + "M"
  : n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k"
  : String(Math.round(n));
const commas = (n) => Math.round(n).toLocaleString("en-US");

/* hairline divider between datasheet sections */
const Rule = ({ m = 22 }) => <div style={{ height: 1, background: C.line, margin: `${m}px 0` }} />;

/* tooltip for the speed chart (tok/s + ms, not GB) */
function SpeedTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0E1116", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", fontFamily: MONO, fontSize: 11.5 }}>
      <div style={{ color: C.muted, marginBottom: 4 }}>{ktok(label)} tokens</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {p.dataKey === "ttft"
            ? (p.value >= 1000 ? (p.value / 1000).toFixed(1) + " s" : Math.round(p.value) + " ms")
            : p.value.toFixed(p.value < 100 ? 1 : 0) + " tok/s"}
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
export default function App() {
  const [params,   setParams]   = useState(30.5);
  const [q,        setQ]        = useState(4);
  const [context,  setContext]  = useState(32768);
  const [ram,      setRam]      = useState(32);
  const [ceiling,  setCeiling]  = useState(29);
  const [layers,   setLayers]   = useState(48);
  const [kvH,      setKvH]      = useState(4);
  const [headDim,  setHeadDim]  = useState(128);
  const [kvBytes,  setKvBytes]  = useState(2);
  const [overhead, setOverhead] = useState(2.5);
  const [scratch,  setScratch]  = useState(6.5);
  const [active,   setActive]   = useState(3.3);
  const [bandwidth,setBandwidth]= useState(120);
  const [eff,      setEff]      = useState(0.45);
  const [macModel, setMacModel] = useState("M4");
  const [gpuTFLOPS,setGpuTFLOPS]= useState(8.5);
  const [prefillEff,setPrefillEff] = useState(PREFILL_EFF);
  const [activePreset, setActivePreset] = useState("Coder-30B-A3B");
  const [hfApplied, setHfApplied] = useState(null);
  const [vizMode,  setVizMode]  = useState("surface"); // '2d' | 'surface'
  const [depthAxis, setDepthAxis] = useState("params");
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState("tool"); // 'tool' | 'explainer'
  const [editSize, setEditSize] = useState(false); // reveal the size slider even when a model is picked

  const hf = useHFModel();
  const mobile = useMediaQuery("(max-width: 760px)");

  const bpw = QUANT.find((x) => x.bits === q)?.bpw ?? 4.25;
  const modelPicked = !!(activePreset || hfApplied);
  const modelLabel = activePreset || (hfApplied ? hfApplied.split("/").pop() : "");

  /* ---- core math ---- */
  const m = useMemo(() => {
    const weights = (params * bpw) / 8;
    const kvBytesPerTok = 2 * layers * kvH * headDim * kvBytes;
    const kvPerTokGB = kvBytesPerTok / 1e9;
    const kv = kvPerTokGB * context;
    const decode  = weights + overhead + kv;
    const prefill = decode + scratch;

    const maxCtxPrefill = Math.max(0, (ceiling - weights - overhead - scratch) / kvPerTokGB);
    const maxCtxDecode  = Math.max(0, (ceiling - weights - overhead) / kvPerTokGB);

    const fitsDecode  = decode  <= ceiling;
    const fitsPrefill = prefill <= ceiling;
    const modelTooBig = weights + overhead > ceiling;

    // decode = bandwidth-bound; reads active weights + the whole KV cache each token
    const tokS = (bandwidth * eff) / ((active * bpw) / 8 + kvPerTokGB * context);
    // prefill = compute-bound; linear matmul + quadratic attention FLOPs
    const prefillFlops = 2 * active * 1e9 * context + 4 * layers * kvH * headDim * context * context;
    const ttftS = prefillFlops / (gpuTFLOPS * 1e12 * prefillEff);

    let state, msg;
    if (modelTooBig) {
      state = "red";
      msg = "Model weights alone clear the ceiling. Drop quant or pick a smaller model.";
    } else if (!fitsDecode) {
      state = "red";
      msg = `Won't load at this context. Model + KV exceed the ceiling before any prefill. Cap context near ${ktok(maxCtxDecode)} tokens.`;
    } else if (!fitsPrefill) {
      state = "amber";
      msg = `Runs, but can't ingest this prompt. Decode fits — the prefill spike overflows by ${gb(prefill - ceiling)} GB. Lower context to ~${ktok(maxCtxPrefill)} or raise the ceiling.`;
    } else {
      state = "green";
      msg = `Fits. Prefill peak lands ${gb(ceiling - prefill)} GB under the ceiling.`;
    }

    return {
      weights, kv, kvPerTokGB, kvBytesPerTok, decode, prefill,
      maxCtxPrefill, maxCtxDecode, fitsDecode, fitsPrefill, modelTooBig,
      tokS, ttftS, state, msg,
    };
  }, [params, bpw, layers, kvH, headDim, kvBytes, context, ceiling, overhead, scratch, active, bandwidth, eff, gpuTFLOPS, prefillEff]);

  /* ---- sweep curve ---- */
  const data = useMemo(() => {
    const xMax = Math.max(context * 1.4, 196608);
    const n = 70;
    return Array.from({ length: n + 1 }, (_, i) => {
      const ctx = (xMax / n) * i;
      const kv = m.kvPerTokGB * ctx;
      return {
        ctx,
        decode:  +(m.weights + overhead + kv).toFixed(2),
        prefill: +(m.weights + overhead + kv + scratch).toFixed(2),
      };
    });
  }, [context, m.kvPerTokGB, m.weights, overhead, scratch]);

  const yTop = Math.ceil(Math.max(ram, data[data.length - 1].prefill) * 1.04);
  const axisMaxScale = Math.max(ram, m.prefill);
  const stateColor = m.state === "green" ? C.ok : m.state === "amber" ? C.warn : C.oom;

  /* ---- speed sweep: decode tok/s (declines as KV grows) + prefill TTFT (climbs) ---- */
  const speedData = useMemo(() => {
    const xMax = Math.min(1048576, Math.max(context * 1.5, 131072));
    const n = 60;
    return Array.from({ length: n + 1 }, (_, i) => {
      const ctx = (xMax / n) * i;
      const tokps = (bandwidth * eff) / ((active * bpw) / 8 + m.kvPerTokGB * ctx);
      const flops = 2 * active * 1e9 * ctx + 4 * layers * kvH * headDim * ctx * ctx;
      const ttft = (flops / (gpuTFLOPS * 1e12 * prefillEff)) * 1000; // ms
      return { ctx, tokps: +tokps.toFixed(1), ttft: +ttft.toFixed(0) };
    });
  }, [context, bandwidth, eff, active, bpw, m.kvPerTokGB, layers, kvH, headDim, gpuTFLOPS, prefillEff]);

  const fmtTTFT = (s) => (s < 1 ? { v: (s * 1000).toFixed(0), u: "ms" } : { v: s.toFixed(s < 10 ? 1 : 0), u: "s" });
  const ttft = fmtTTFT(m.ttftS);

  const applyMac = (name) => {
    const spec = MAC_SPECS.find((x) => x.name === name);
    if (!spec) return;
    setMacModel(name);
    setBandwidth(spec.bw);
    setGpuTFLOPS(spec.tflops);
  };

  const applyPreset = (p) => {
    setActivePreset(p.name);
    setEditSize(false);
    setParams(p.params);
    setQ(p.q);
    setLayers(p.layers);
    setKvH(p.kvH);
    setHeadDim(p.headDim);
    setActive(p.active);
    setHfApplied(null);
  };

  const applyHFModel = (data) => {
    setActivePreset("");
    setEditSize(false);
    setHfApplied(data.modelId);
    if (data.params)      setParams(+data.params.toFixed(2));
    if (data.layers)      setLayers(data.layers);
    if (data.kvH)         setKvH(data.kvH);
    if (data.headDim)     setHeadDim(data.headDim);
    if (data.contextLength) {
      const ctx = Math.min(data.contextLength, 1048576);
      setContext(ctx);
    }
    if (data.activeParams) setActive(+data.activeParams.toFixed(2));
  };

  const setRamAndCeiling = (r) => {
    setRam(r);
    setCeiling(Math.max(4, r - 3));
  };

  /* shared button style for chip-style toggles */
  const chip = (on, accent, tint) => ({
    flex: 1, fontFamily: MONO, fontSize: 12, padding: "8px 0", borderRadius: 6,
    border: `1px solid ${on ? accent : C.line}`,
    background: on ? tint : "transparent",
    color: on ? C.text : C.muted, cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s, color 0.15s",
  });

  /* footprint viz (2D line / 3D surface) — reused in-column or full-width when expanded */
  const footprint = (big) => (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <SectionTag n="06" accent={C.kv}>
          {vizMode === "surface" ? "Footprint surface" : "Footprint vs context"}
        </SectionTag>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: big ? 0 : -14 }}>
          {vizMode === "surface" && (
            <div style={{ display: "flex", border: `1px solid ${C.line}`, borderRadius: 6, overflow: "hidden" }}>
              {[["params", "size"], ["quant", "quant"]].map(([mode, lbl]) => {
                const on = mode === depthAxis;
                return (
                  <button key={mode} onClick={() => setDepthAxis(mode)}
                    style={{
                      fontFamily: DISPLAY, fontWeight: 600, fontSize: 10.5, letterSpacing: 0.5,
                      padding: "4px 10px", border: "none", cursor: "pointer",
                      background: on ? C.weights : "transparent",
                      color: on ? "#fff" : C.muted, transition: "background 0.15s, color 0.15s",
                    }}>
                    {lbl}
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", border: `1px solid ${C.line}`, borderRadius: 6, overflow: "hidden" }}>
            {[["2d", "2D"], ["surface", "3D"]].map(([mode, lbl]) => {
              const on = mode === vizMode;
              return (
                <button key={mode} onClick={() => setVizMode(mode)}
                  style={{
                    fontFamily: DISPLAY, fontWeight: 600, fontSize: 10.5, letterSpacing: 1,
                    padding: "4px 11px", border: "none", cursor: "pointer",
                    background: on ? C.kv : "transparent",
                    color: on ? "#1a1205" : C.muted, transition: "background 0.15s, color 0.15s",
                  }}>
                  {lbl}
                </button>
              );
            })}
          </div>
          <button onClick={() => setExpanded((e) => !e)} title={big ? "Collapse" : "Expand to full width"}
            style={{
              width: 28, height: 26, borderRadius: 6, cursor: "pointer", fontSize: 13,
              border: `1px solid ${big ? C.kv : C.line}`, background: big ? "rgba(201,148,46,0.16)" : "transparent",
              color: big ? C.kv : C.muted, transition: "border-color 0.15s, color 0.15s, background 0.15s",
            }}>
            {big ? "⤡" : "⤢"}
          </button>
        </div>
      </div>

      {vizMode === "surface" ? (
        <Surface
          bpw={bpw} overhead={overhead} scratch={scratch}
          kvPerTokGB={m.kvPerTokGB} ceiling={ceiling}
          context={context} params={params} depthAxis={depthAxis}
          verdict={{ state: m.state, msg: m.msg }}
          height={big ? 560 : 380}
        />
      ) : (
        <div style={{ width: "100%", height: big ? 400 : 230 }}>
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 2 }}>
              <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="ctx" type="number" domain={[0, "dataMax"]} tickFormatter={ktok}
                stroke={C.faint} tick={{ fontSize: 10, fontFamily: MONO, fill: C.muted }} />
              <YAxis domain={[0, yTop]} stroke={C.faint}
                tick={{ fontSize: 10, fontFamily: MONO, fill: C.muted }} tickFormatter={(v) => v + ""} />
              <ReferenceArea y1={ceiling} y2={yTop} fill={C.oom} fillOpacity={0.07} />
              <Tooltip content={<TipBox />} />
              <Area type="monotone" dataKey="prefill" stroke={C.scratch} strokeWidth={1.5}
                fill={C.scratch} fillOpacity={0.10} name="prefill peak" dot={false} />
              <Line type="monotone" dataKey="decode" stroke={C.kv} strokeWidth={1.8} dot={false} name="decode" />
              <ReferenceLine y={ceiling} stroke={C.oom} strokeWidth={1.4} strokeDasharray="5 3"
                label={{ value: "redline", fill: C.oom, fontSize: 10, fontFamily: MONO, position: "insideTopRight" }} />
              <ReferenceLine y={ram} stroke={C.faint} strokeDasharray="2 4"
                label={{ value: ram + " GB", fill: C.faint, fontSize: 9.5, fontFamily: MONO, position: "insideBottomRight" }} />
              <ReferenceLine x={context} stroke={C.text} strokeOpacity={0.55} strokeWidth={1}
                label={{ value: "now", fill: C.text, fontSize: 10, fontFamily: MONO, position: "top" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {vizMode === "2d" && (
        <div style={{
          display: "flex", gap: 11, alignItems: "center", marginTop: 14,
          borderLeft: `3px solid ${stateColor}`,
          background: `linear-gradient(90deg, ${stateColor}14, ${stateColor}00 70%)`,
          padding: "10px 14px",
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: 8, background: stateColor, flexShrink: 0,
            boxShadow: `0 0 9px ${stateColor}`,
            animation: m.state !== "green" ? "dotGlow 1.6s ease-in-out infinite" : "none",
          }} />
          <span style={{ fontSize: 13, color: C.text }}>{m.msg}</span>
        </div>
      )}
      <p style={{ fontSize: 11, color: C.faint, marginTop: 10, lineHeight: 1.6 }}>
        {vizMode === "surface"
          ? (depthAxis === "quant"
              ? "Height is peak memory across every quantization × context. The red frontier traces where your build crosses the redline; the marker is where you sit now."
              : "Height is peak memory across every model size × context. The red frontier traces where your build crosses the redline; the marker is where you sit now.")
          : "Decode footprint clears the ceiling long before the prefill peak does — which is exactly why a model can chat fine at a big context, then die the moment you hand it a long prompt."}
      </p>
    </>
  );

  /* feasibility: green = prefill fits · amber = decode-only · red = won't load */
  const fitAt = (sizeB, ctx) => {
    const weights = (sizeB * bpw) / 8;
    const total = weights + overhead + m.kvPerTokGB * ctx;
    if (total + scratch <= ceiling) return "ok";
    if (total <= ceiling) return "warn";
    return "oom";
  };
  const REPORT_SIZES = [3, 7, 13, 30, 70, 120];
  const REPORT_CTX = [4096, 16384, 32768, 65536, 131072, 262144, 1048576];
  const kvLabel = kvBytes >= 2 ? "fp16" : kvBytes >= 1 ? "8-bit" : "4-bit";
  const nearIdx = (arr, v) => arr.reduce((b, x, i) => (Math.abs(x - v) < Math.abs(arr[b] - v) ? i : b), 0);
  const curRow = nearIdx(REPORT_SIZES, params);
  const curCol = nearIdx(REPORT_CTX, context);

  /* ================================================================ */
  return (
    <ExplainerProvider>
    <div style={{ color: C.text, fontFamily: SANS, minHeight: "100vh" }}>
      <Background />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "0 auto", padding: mobile ? "22px 14px 48px" : "40px 26px 64px" }}>

        {/* ════════ MASTHEAD ════════ */}
        <header className="reveal" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "relative", zIndex: 1, fontFamily: MONO, color: C.faint, fontSize: 10.5, letterSpacing: 4, textTransform: "uppercase", marginBottom: 6 }}>
              Local inference · Apple Silicon
            </div>
            <Title fontSize={mobile ? 42 : 64} />
            <button
              onClick={() => setView(view === "tool" ? "explainer" : "tool")}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.kv)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
              style={{
                position: "relative", zIndex: 1, marginTop: 16, display: "block",
                fontFamily: MONO, fontSize: 12, letterSpacing: 2.5, color: C.muted,
                background: "none", border: "none", padding: 0, cursor: "pointer",
                textTransform: "uppercase", transition: "color 0.15s", textAlign: "left",
              }}
            >
              {view === "tool" ? "[ Explainer ]" : "[ ← Back ]"}
            </button>
          </div>

          <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 10.5, color: C.faint, lineHeight: 1.9, paddingBottom: 4 }}>
            <div>specs · <span style={{ color: C.muted }}>HuggingFace Hub</span></div>
            <div>math · <span style={{ color: C.muted }}>100% client-side</span></div>
            <div>target · <span style={{ color: C.muted }}>MLX / Metal</span></div>
          </div>
        </header>

        {/* frosted blur behind the content below the title (title stays clear over particles) */}
        <div style={{ position: "relative" }}>
        <div className="content-frost" />

        {view === "explainer" && <ExplainerPage />}

        {view === "tool" && (<>
        {/* ════════ SOURCE STRIP (load a model) ════════ */}
        <div className="reveal" style={{ animationDelay: "0.06s", marginTop: 30, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, padding: "14px 0" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 260px", minWidth: 240 }}>
              <svg width="20" height="20" viewBox="0 0 95 88" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M47.2 0C21.1 0 0 19.7 0 44s21.1 44 47.2 44 47.2-19.7 47.2-44S73.3 0 47.2 0Z" fill={C.line}/>
                <path d="M33.6 52.3c-3.5 0-6.4-2.8-6.4-6.2 0-3.5 2.9-6.3 6.4-6.3 3.6 0 6.4 2.8 6.4 6.3 0 3.4-2.8 6.2-6.4 6.2Zm27.2 0c-3.5 0-6.4-2.8-6.4-6.2 0-3.5 2.9-6.3 6.4-6.3 3.5 0 6.4 2.8 6.4 6.3 0 3.4-2.9 6.2-6.4 6.2Z" fill={C.kv}/>
                <path d="M47.2 70.4c-8.8 0-16-6.5-16-14.5h32c0 8-7.2 14.5-16 14.5Z" fill={C.weights}/>
                <path d="M27 32.8c-.8-4.3 1.4-8.6 5.2-9.3l4.7 8.6-9.9.7Zm40.4 0c.8-4.3-1.4-8.6-5.2-9.3l-4.7 8.6 9.9.7Z" fill={C.muted}/>
              </svg>
              <HFSearch hf={hf} onApply={applyHFModel} />
              {hfApplied && (
                <div style={{ fontFamily: MONO, fontSize: 11, color: C.ok, flexShrink: 0, whiteSpace: "nowrap" }}>
                  ✓ {hfApplied.split("/").pop()}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {PRESETS.map((p) => {
                const on = activePreset === p.name;
                return (
                  <button
                    key={p.name}
                    className="hover-lift"
                    onClick={() => applyPreset(p)}
                    style={{
                      fontFamily: MONO, fontSize: 11, padding: "6px 9px", borderRadius: 6,
                      border: `1px solid ${on ? C.weights : C.line}`,
                      background: on ? "rgba(91,122,153,0.16)" : "transparent",
                      color: on ? C.text : C.muted, cursor: "pointer", textAlign: "left",
                      transition: "border-color 0.15s, background 0.15s, color 0.15s",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 9, color: C.faint, letterSpacing: 1, textTransform: "uppercase" }}>{p.note}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ════════ DATASHEET GRID ════════ */}
        <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: mobile ? "1fr" : "minmax(0,0.86fr) minmax(0,1.14fr)", gap: 0 }}>

          {/* full-width footprint when expanded — pushes the columns below */}
          {expanded && (
            <div className="expand-band" style={{ gridColumn: "1 / -1", marginBottom: 30, paddingBottom: 26, borderBottom: `1px solid ${C.line}`, position: "relative", zIndex: 5 }}>
              {footprint(true)}
            </div>
          )}

          {/* ─────── LEFT · INPUTS ─────── */}
          <div className="reveal" style={{ animationDelay: "0.18s", minWidth: 0, paddingRight: mobile ? 0 : 40 }}>

            {/* 01 HARDWARE — your Mac sets the budget + the speed ceiling */}
            <SectionTag n="01" accent={C.ok}>Hardware</SectionTag>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <select value={macModel} className="hover-lift" onChange={(e) => applyMac(e.target.value)}
                style={{ fontFamily: MONO, fontSize: 12.5, color: C.text, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 10px", outline: "none", cursor: "pointer" }}>
                {MAC_SPECS.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
              <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>
                <span style={{ color: C.kv }}>{bandwidth}</span> GB/s · <span style={{ color: C.weights }}>{gpuTFLOPS}</span> TFLOPS <span style={{ color: C.faint }}>· est.</span>
              </span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.faint, marginTop: 7, letterSpacing: 0.3 }}>
              bandwidth ·{" "}
              <a href={MAC_SPECS_META.source?.[0]} target="_blank" rel="noopener noreferrer" style={{ color: C.muted, textDecoration: "none" }}>Wikipedia</a>
              {" "}({MAC_SPECS_META.fetchedAt}) · TFLOPS est.
            </div>

            <div style={{ fontSize: 10.5, color: C.muted, fontFamily: MONO, letterSpacing: 1.5, margin: "18px 0 8px", textTransform: "uppercase" }}>
              Unified memory <InfoDot k="ceiling" />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {RAM_OPTIONS.map((r) => {
                const on = r === ram;
                return (
                  <button key={r} className="hover-lift" onClick={() => setRamAndCeiling(r)}
                    style={{
                      fontFamily: MONO, fontSize: 12, padding: "8px 12px", borderRadius: 6,
                      border: `1px solid ${on ? C.ceiling : C.line}`,
                      background: on ? "rgba(232,234,237,0.10)" : "transparent",
                      color: on ? C.text : C.muted, cursor: "pointer",
                      transition: "border-color 0.15s, background 0.15s, color 0.15s",
                    }}>
                    {r}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
              <span style={{ fontSize: 12.5, color: C.muted }}>Usable ceiling (redline)</span>
              <span style={{ fontFamily: MONO, fontSize: 13 }}>
                <NumberInput value={ceiling} onChange={setCeiling} step={0.5} min={2} max={ram} />{" "}
                <span style={{ color: C.faint }}>GB</span>
              </span>
            </div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 8 }}>
              ~{(ram - ceiling).toFixed(1)} GB held back for the OS / wired memory before swap kicks in.
            </div>

            <Rule />

            {/* 02 MODEL — size is set once you pick a model; quant is the live lever */}
            <SectionTag n="02" accent={C.weights}>Model</SectionTag>
            <div style={{ fontSize: 10.5, color: C.muted, fontFamily: MONO, letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" }}>
              Quantization <InfoDot k="quant" />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {QUANT.map((x) => (
                <button key={x.bits} className="hover-lift" onClick={() => setQ(x.bits)}
                  style={chip(x.bits === q, C.weights, "rgba(91,122,153,0.18)")}>
                  {x.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 10, fontFamily: MONO }}>
              weights = {params.toFixed(1)} × {bpw} / 8 = <span style={{ color: C.weights }}>{gb(m.weights)} GB</span>
            </div>
            <div style={{ height: 16 }} />
            {modelPicked && !editSize ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10.5, color: C.muted, fontFamily: MONO, letterSpacing: 1.5, textTransform: "uppercase" }}>Model size</div>
                  <div style={{ fontFamily: MONO, fontSize: 15, color: C.text, marginTop: 4 }}>
                    {params.toFixed(1)} <span style={{ fontSize: 11, color: C.faint }}>B · from {modelLabel}</span>
                  </div>
                </div>
                <button className="hover-lift" onClick={() => setEditSize(true)}
                  style={{ fontFamily: MONO, fontSize: 11, color: C.muted, background: "none", border: `1px solid ${C.line}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer", flexShrink: 0 }}>
                  adjust ▸
                </button>
              </div>
            ) : (
              <Slider
                label="Model size" unit="B params" value={params}
                min={0.5} max={120} step={0.5}
                onChange={(v) => { setParams(v); setActivePreset(""); }}
                accent={C.weights} fmt={(v) => v.toFixed(1)}
              />
            )}

            <Rule />

            {/* 03 CONTEXT */}
            <SectionTag n="03" accent={C.kv}>Context window <InfoDot k="kv" /></SectionTag>
            <Slider
              label="Context window" unit="tokens" value={context}
              min={1024} max={1048576} step={512} log
              onChange={setContext} accent={C.kv} fmt={(v) => commas(v)}
              snapPoints={CTX_SNAP_POINTS}
            />
            <div style={{ position: "relative", height: 18, marginTop: 20, paddingTop: 4 }}>
              {[1024, 4096, 16384, 65536, 262144, 1048576].map((p) => {
                const isActive = context === p;
                const pos = (Math.log(p / 1024) / Math.log(1048576 / 1024)) * 100;
                const shift = pos <= 0 ? "0" : pos >= 100 ? "-100%" : "-50%";
                return (
                  <button key={p} onClick={() => setContext(p)}
                    style={{
                      position: "absolute", left: `${pos}%`, transform: `translateX(${shift})`,
                      whiteSpace: "nowrap", fontFamily: MONO, fontSize: 9.5,
                      color: isActive ? C.kv : C.faint, background: "none", border: "none",
                      cursor: "pointer", padding: "2px 4px", borderRadius: 3, letterSpacing: 0.3,
                      transition: "color 0.15s",
                    }}>
                    {ktok(p)}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 10, fontFamily: MONO, lineHeight: 1.6 }}>
              KV = <span style={{ color: C.kv }}>{(m.kvBytesPerTok / 1024).toFixed(0)} KB/token</span>, resident all session<br />
              {commas(context)} tok → <span style={{ color: C.kv }}>{gb(m.kv)} GB</span> of KV cache
            </div>

            <Rule />

            {/* 04 KV GEOMETRY */}
            <SectionTag n="04" accent={C.kv}>Attention / KV geometry <InfoDot k="geometry" /></SectionTag>
            <div style={{ fontSize: 10.5, color: C.faint, marginBottom: 12, fontFamily: MONO }}>
              KV/token = 2 · layers · kv-heads · head-dim · bytes
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <GeoField label="layers"   value={layers}  onChange={setLayers} />
              <GeoField label="kv heads" value={kvH}     onChange={setKvH} />
              <GeoField label="head dim" value={headDim} onChange={setHeadDim} />
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: C.faint, marginBottom: 6, fontFamily: MONO, textTransform: "uppercase", letterSpacing: 0.5 }}>
                KV precision <InfoDot k="kvprec" />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {KVQUANT.map((k) => (
                  <button key={k.label} className="hover-lift" onClick={() => setKvBytes(k.bytes)}
                    style={chip(k.bytes === kvBytes, C.kv, "rgba(201,148,46,0.16)")}>
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            <Rule />

            {/* 05 RUNTIME */}
            <SectionTag n="05" accent={C.faint}>Runtime &amp; speed <InfoDot k="speed" /></SectionTag>
            <div style={{ marginTop: 6 }}>
              <Row label="Runtime overhead" hint="MLX / Metal / server baseline">
                <span style={{ color: C.faint, marginRight: 8 }}>GB</span><NumberInput value={overhead} onChange={setOverhead} step={0.5} min={0} max={12} />
              </Row>
              <Row label="Prefill scratch" hint="transient spike while ingesting the prompt">
                <span style={{ color: C.faint, marginRight: 8 }}>GB</span><NumberInput value={scratch} onChange={setScratch} step={0.5} min={0} max={16} />
              </Row>
              <div style={{ height: 1, background: C.line, margin: "12px 0" }} />
              <Row label="Active params" hint="MoE: what actually moves per token → speed">
                <span style={{ color: C.faint, marginRight: 8 }}>B</span><NumberInput value={active} onChange={setActive} step={0.1} min={0.1} max={params} />
              </Row>
              <Row label="Memory bandwidth" hint="set by Mac model · overridable">
                <span style={{ color: C.faint, marginRight: 8 }}>GB/s</span><NumberInput value={bandwidth} onChange={setBandwidth} step={10} min={50} max={1000} />
              </Row>
              <Row label="Decode efficiency" hint="fraction of peak bandwidth realized">
                <NumberInput value={eff} onChange={setEff} step={0.05} min={0.1} max={0.95} />
              </Row>
              <Row label="GPU compute" hint="fp16 TFLOPS · drives prefill speed">
                <span style={{ color: C.faint, marginRight: 8 }}>TFLOPS</span><NumberInput value={gpuTFLOPS} onChange={setGpuTFLOPS} step={1} min={1} max={200} />
              </Row>
              <Row label="Prefill efficiency" hint="fraction of peak FLOPs realized">
                <NumberInput value={prefillEff} onChange={setPrefillEff} step={0.05} min={0.1} max={0.9} />
              </Row>
            </div>
          </div>

          {/* ─────── RIGHT · OUTPUT ─────── */}
          <div className="reveal" style={{
            animationDelay: "0.24s", minWidth: 0,
            borderLeft: mobile ? "none" : `1px solid ${C.line}`,
            paddingLeft: mobile ? 0 : 44,
            borderTop: mobile ? `1px solid ${C.line}` : "none",
            paddingTop: mobile ? 28 : 0,
            marginTop: mobile ? 28 : 0,
          }}>

            {!expanded && footprint(false)}

            {!expanded && <Rule m={26} />}

            {/* ── 07 MEMORY PRESSURE ── */}
            <SectionTag n="07" accent={stateColor} glitch={m.prefill > ceiling} label="Memory pressure">Memory pressure <InfoDot k="prefilldecode" /></SectionTag>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              <StackBar
                label="resident · decode" total={m.decode} ceiling={ceiling} scaleMax={axisMaxScale}
                segs={[{ w: m.weights, color: C.weights }, { w: m.kv, color: C.kv }, { w: overhead, color: C.overhead }]}
              />
              <StackBar
                label="peak · prefill" total={m.prefill} ceiling={ceiling} scaleMax={axisMaxScale} alert
                segs={[{ w: m.weights, color: C.weights }, { w: m.kv, color: C.kv }, { w: overhead, color: C.overhead }, { w: scratch, color: C.scratch, hatch: true }]}
              />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 14, fontFamily: MONO, fontSize: 11 }}>
              <Key color={C.weights} label="weights"  v={m.weights} />
              <Key color={C.kv}      label="kv cache" v={m.kv} />
              <Key color={C.overhead}label="overhead" v={overhead} />
              <Key color={C.scratch} label="prefill"  v={scratch} hatch />
            </div>

            <Rule m={26} />

            {/* ── 08 LIMITS ── */}
            <SectionTag n="08" accent={C.faint} glitch={m.prefill > ceiling}>Limits</SectionTag>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px 18px" }}>
              <BigReadout
                label="Decode · resident" value={gb(m.decode)} unit="GB" ok={m.fitsDecode}
                sub={m.fitsDecode ? `${gb(ceiling - m.decode)} GB to spare` : `over by ${gb(m.decode - ceiling)} GB`}
              />
              <BigReadout
                label="Prefill · peak" value={gb(m.prefill)} unit="GB" ok={m.fitsPrefill}
                sub={m.fitsPrefill ? `${gb(ceiling - m.prefill)} GB to spare` : `over by ${gb(m.prefill - ceiling)} GB`}
              />
              <BigReadout
                label="Max ctx · prefill-limited" value={ktok(m.maxCtxPrefill)} unit="tok"
                ok={context <= m.maxCtxPrefill} sub="the wall you actually hit" accent={C.scratch}
              />
              <BigReadout
                label="Max ctx · decode-limited" value={ktok(m.maxCtxDecode)} unit="tok"
                ok={context <= m.maxCtxDecode} sub="if you never re-ingest a big prompt" accent={C.kv}
              />
            </div>

            <Rule m={26} />

            {/* ── 09 SPEED ── */}
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <SectionTag n="09" accent={C.ok}>Speed <InfoDot k="speed" /></SectionTag>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, marginTop: -14 }}>
                <span style={{ color: C.text }}>{macModel}</span> · <span style={{ color: C.kv }}>{bandwidth}</span> GB/s · <span style={{ color: C.weights }}>{gpuTFLOPS}</span> TFLOPS
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px", marginBottom: 16 }}>
              <BigReadout label="Decode throughput" value={m.tokS.toFixed(m.tokS < 100 ? 1 : 0)} unit="tok/s" ok accent={C.kv}
                sub="generation, bandwidth-bound" />
              <BigReadout label="Prefill · time to first token" value={ttft.v} unit={ttft.u} ok={m.fitsPrefill} accent={C.scratch}
                sub={`ingest ${commas(context)} tok, compute-bound`} />
            </div>
            <div style={{ width: "100%", height: 210 }}>
              <ResponsiveContainer>
                <ComposedChart data={speedData} margin={{ top: 8, right: 4, left: -10, bottom: 2 }}>
                  <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="ctx" type="number" domain={[0, "dataMax"]} tickFormatter={ktok}
                    stroke={C.faint} tick={{ fontSize: 10, fontFamily: MONO, fill: C.muted }} />
                  <YAxis yAxisId="L" stroke={C.kv} tick={{ fontSize: 9.5, fontFamily: MONO, fill: C.kv }}
                    tickFormatter={(v) => v + ""} width={38} />
                  <YAxis yAxisId="R" orientation="right" stroke={C.scratch} tick={{ fontSize: 9.5, fontFamily: MONO, fill: C.scratch }}
                    tickFormatter={(v) => (v >= 1000 ? (v / 1000).toFixed(0) + "s" : v + "ms")} width={42} />
                  <Tooltip content={<SpeedTip />} />
                  <Line yAxisId="L" type="monotone" dataKey="tokps" stroke={C.kv} strokeWidth={1.8} dot={false} name="decode tok/s" />
                  <Line yAxisId="R" type="monotone" dataKey="ttft" stroke={C.scratch} strokeWidth={1.8} dot={false} name="prefill (ms)" />
                  <ReferenceLine yAxisId="L" x={context} stroke={C.text} strokeOpacity={0.55} strokeWidth={1}
                    label={{ value: "now", fill: C.text, fontSize: 10, fontFamily: MONO, position: "top" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p style={{ fontSize: 11, color: C.faint, marginTop: 10, lineHeight: 1.6 }}>
              <span style={{ color: C.kv }}>Decode</span> slows as the KV cache grows (more bytes to stream per token);{" "}
              <span style={{ color: C.scratch }}>prefill</span> time climbs with context (attention is quadratic). Rough estimates — validate on-device.
            </p>
          </div>
        </div>

        {/* ════════ FEASIBILITY REPORT ════════ */}
        <div className="reveal" style={{ animationDelay: "0.3s", marginTop: 40 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <SectionTag n="10" accent={C.ok}>What fits — common builds</SectionTag>
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, marginTop: -14 }}>
              at <span style={{ color: C.weights }}>{q}-bit</span> · <span style={{ color: C.kv }}>{kvLabel}</span> KV · <span style={{ color: C.ceiling }}>{gb(ceiling)} GB</span> ceiling
            </span>
          </div>

          <div style={{ overflowX: mobile ? "auto" : "visible", WebkitOverflowScrolling: "touch" }}>
          <div style={{ display: "grid", gridTemplateColumns: `52px repeat(${REPORT_CTX.length}, 1fr)`, gap: 6, alignItems: "center", minWidth: mobile ? 560 : "auto" }}>
            {/* header row */}
            <div />
            {REPORT_CTX.map((c, j) => (
              <div key={c} style={{ textAlign: "center", fontFamily: MONO, fontSize: 10, color: j === curCol ? C.text : C.faint }}>
                {ktok(c)}
              </div>
            ))}
            {/* model rows */}
            {REPORT_SIZES.map((s, i) => (
              <React.Fragment key={s}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, color: i === curRow ? C.text : C.muted, textAlign: "right", paddingRight: 6 }}>
                  {s}B
                </div>
                {REPORT_CTX.map((c, j) => {
                  const f = fitAt(s, c);
                  const col = f === "ok" ? C.ok : f === "warn" ? C.warn : C.oom;
                  const here = i === curRow && j === curCol;
                  return (
                    <div key={c} title={f === "ok" ? "fits" : f === "warn" ? "decode only — long prompts overflow" : "won't load"}
                      style={{
                        height: 28, borderRadius: 5, background: `${col}26`,
                        border: here ? `1.5px solid ${C.text}` : `1px solid ${col}55`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: MONO, fontSize: 11, color: col,
                        boxShadow: here ? `0 0 10px ${col}66` : "none",
                      }}>
                      {f === "ok" ? "✓" : f === "warn" ? "~" : "✕"}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 14, fontFamily: MONO, fontSize: 11 }}>
            {[["✓", C.ok, "fits — prompt + reply"], ["~", C.warn, "decode only — long prompts overflow"], ["✕", C.oom, "won't load"]].map(([g, col, lbl]) => (
              <span key={lbl} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, background: `${col}26`, border: `1px solid ${col}55`, color: col, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>{g}</span>
                <span style={{ color: C.muted }}>{lbl}</span>
              </span>
            ))}
            <span style={{ color: C.faint }}>· outlined cell = your current build</span>
          </div>
        </div>

        {/* ════════ REALITY CHECK (derived insights) ════════ */}
        {(() => {
          const words = context * 0.75;                       // ~0.75 words / token
          const pages = words / 500;                          // ~500 words / page
          const headroom = m.maxCtxPrefill - context;         // tokens left before redline
          const replySecs = m.ttftS + (m.tokS > 0 ? 1000 / m.tokS : 0); // 1k-token reply
          const kvShare = m.decode > 0 ? (m.kv / m.decode) * 100 : 0;
          const fmtWords = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : Math.round(n) + "");
          return (
            <div className="reveal" style={{ animationDelay: "0.34s", marginTop: 40 }}>
              <SectionTag n="11" accent={C.kv}>Reality check — what you might be missing <InfoDot k="reality" /></SectionTag>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "22px 18px", marginTop: 8 }}>
                <BigReadout
                  label="Context in plain terms" value={fmtWords(words)} unit="words" ok accent={C.kv}
                  sub={`≈ ${Math.round(pages).toLocaleString("en-US")} pages held in memory`}
                />
                <BigReadout
                  label="Headroom left" value={headroom > 0 ? ktok(headroom) : "0"} unit="tok"
                  ok={headroom > 0} accent={C.scratch}
                  sub={headroom > 0 ? "more context before the redline" : "already over the redline"}
                />
                <BigReadout
                  label="Download weight" value={gb(m.weights)} unit="GB" ok accent={C.weights}
                  sub="to pull over the network + store on disk"
                />
                <BigReadout
                  label="Full reply time" value={replySecs >= 100 ? Math.round(replySecs) + "" : replySecs.toFixed(1)} unit="s"
                  ok={m.fitsPrefill} accent={C.ok}
                  sub="a 1,000-token answer, incl. time-to-first-token"
                />
                <BigReadout
                  label="KV share of memory" value={kvShare.toFixed(0)} unit="%"
                  ok={kvShare < 50} accent={C.kv}
                  sub={kvShare < 50 ? "of resident memory is cache, not model" : "cache now outweighs the model — quantize KV"}
                />
              </div>
            </div>
          );
        })()}
        </>)}

        {/* ════════ FOOTER ════════ */}
        <div style={{ marginTop: 48, borderTop: `1px solid ${C.line}`, paddingTop: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>
            Model specs via{" "}
            <a href="https://huggingface.co" target="_blank" rel="noopener noreferrer" style={{ color: C.muted, textDecoration: "none" }}>
              HuggingFace Hub API
            </a>{" "}· all math client-side
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>
            Numbers are estimates — validate with{" "}
            <code style={{ color: C.muted }}>mlx_lm.server --model &lt;id&gt;</code>
          </span>
        </div>
        </div>
      </div>
    </div>
    </ExplainerProvider>
  );
}
