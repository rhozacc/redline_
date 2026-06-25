import React, { useState, useMemo } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, ReferenceLine, ReferenceArea,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { C, MONO, SANS, QUANT, KVQUANT, RAM_OPTIONS, CTX_SNAP_POINTS, PRESETS } from "./constants.js";
import {
  Panel, Slider, NumberInput, GeoField, Row,
  Gauge, Key, Stat, TipBox, HFSearch, Spinner,
} from "./components.jsx";
import useHFModel from "./useHFModel.js";

/* ------------------------------------------------------------------ */
const gb  = (n) => (n < 10 ? n.toFixed(2) : n.toFixed(1));
const ktok = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(Math.round(n)));
const commas = (n) => Math.round(n).toLocaleString("en-US");

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
  const [adv,      setAdv]      = useState(false);
  const [overhead, setOverhead] = useState(2.5);
  const [scratch,  setScratch]  = useState(6.5);
  const [active,   setActive]   = useState(3.3);
  const [bandwidth,setBandwidth]= useState(120);
  const [eff,      setEff]      = useState(0.45);
  const [activePreset, setActivePreset] = useState("Coder-30B-A3B");
  const [hfApplied, setHfApplied] = useState(null);

  const hf = useHFModel();

  const bpw = QUANT.find((x) => x.bits === q)?.bpw ?? 4.25;

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

    const bytesPerTokPass = (active * bpw) / 8;
    const tokS = (bandwidth * eff) / bytesPerTokPass;

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
      tokS, state, msg,
    };
  }, [params, bpw, layers, kvH, headDim, kvBytes, context, ceiling, overhead, scratch, active, bandwidth, eff]);

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

  const applyPreset = (p) => {
    setActivePreset(p.name);
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
    setHfApplied(data.modelId);
    if (data.params)      setParams(+data.params.toFixed(2));
    if (data.layers)      setLayers(data.layers);
    if (data.kvH)         setKvH(data.kvH);
    if (data.headDim)     setHeadDim(data.headDim);
    if (data.contextLength) {
      const ctx = Math.min(data.contextLength, 262144);
      setContext(ctx);
    }
    if (data.activeParams) setActive(+data.activeParams.toFixed(2));
  };

  const setRamAndCeiling = (r) => {
    setRam(r);
    setCeiling(Math.max(4, r - 3));
  };

  /* ================================================================ */
  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: SANS, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 20px 60px" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 6 }}>
          <div>
            <div style={{ fontFamily: MONO, color: C.faint, fontSize: 11, letterSpacing: 3, textTransform: "uppercase" }}>
              Local inference · Apple Silicon
            </div>
            <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1, lineHeight: 1, marginTop: 2 }}>
              Redline
            </div>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 6, maxWidth: 460 }}>
              Unified-memory budget. Watch KV cache eat your headroom as context grows —
              and where the prefill spike tips you into swap.
            </div>
          </div>

          {/* presets */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PRESETS.map((p) => {
              const on = activePreset === p.name;
              return (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  style={{
                    fontFamily: MONO,
                    fontSize: 11.5,
                    padding: "7px 10px",
                    borderRadius: 7,
                    border: `1px solid ${on ? C.weights : C.line}`,
                    background: on ? "rgba(91,122,153,0.16)" : C.panel,
                    color: on ? C.text : C.muted,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "border-color 0.15s, background 0.15s, color 0.15s",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 9.5, color: C.faint, letterSpacing: 1, textTransform: "uppercase" }}>
                    {p.note}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── HF SEARCH BAR ── */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: C.panel,
            border: `1px solid ${C.line}`,
            borderRadius: 10,
            padding: "10px 14px",
          }}
        >
          {/* HF logo */}
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
          <div style={{ fontSize: 11.5, color: C.faint, flexShrink: 0, whiteSpace: "nowrap" }}>
            or pick a preset →
          </div>
        </div>

        {/* ── VERDICT ── */}
        <div
          style={{
            marginTop: 12,
            borderRadius: 10,
            border: `1px solid ${stateColor}44`,
            background: `${stateColor}10`,
            padding: "12px 16px",
            display: "flex",
            gap: 12,
            alignItems: "center",
            transition: "border-color 0.3s, background 0.3s",
          }}
        >
          <span
            style={{
              width: 9, height: 9, borderRadius: 9,
              background: stateColor,
              flexShrink: 0,
              boxShadow: `0 0 10px ${stateColor}`,
              animation: m.state !== "green" ? "dotGlow 1.6s ease-in-out infinite" : "none",
            }}
          />
          <span style={{ fontSize: 13.5, color: C.text }}>{m.msg}</span>
        </div>

        {/* ── MAIN GRID ── */}
        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "minmax(0,38%) minmax(0,62%)",
            gap: 18,
          }}
        >
          {/* ──────── LEFT: CONTROLS ──────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

            {/* Model + quant */}
            <Panel>
              <Slider
                label="Model size"
                unit="B params"
                value={params}
                min={0.5}
                max={120}
                step={0.5}
                onChange={(v) => { setParams(v); setActivePreset(""); }}
                accent={C.weights}
                fmt={(v) => v.toFixed(1)}
              />
              <div style={{ height: 16 }} />
              <div style={{ fontSize: 11.5, color: C.muted, fontFamily: MONO, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
                Quantization
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {QUANT.map((x) => {
                  const on = x.bits === q;
                  return (
                    <button
                      key={x.bits}
                      onClick={() => { setQ(x.bits); setActivePreset(""); }}
                      style={{
                        flex: 1, fontFamily: MONO, fontSize: 12,
                        padding: "8px 0", borderRadius: 6,
                        border: `1px solid ${on ? C.weights : C.line}`,
                        background: on ? "rgba(91,122,153,0.18)" : "transparent",
                        color: on ? C.text : C.muted, cursor: "pointer",
                        transition: "border-color 0.15s, background 0.15s, color 0.15s",
                      }}
                    >
                      {x.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: C.faint, marginTop: 8, fontFamily: MONO }}>
                weights = {params.toFixed(1)} × {bpw} / 8 ={" "}
                <span style={{ color: C.weights }}>{gb(m.weights)} GB</span>
              </div>
            </Panel>

            {/* Context */}
            <Panel>
              <Slider
                label="Context window"
                unit="tokens"
                value={context}
                min={1024}
                max={262144}
                step={512}
                onChange={setContext}
                accent={C.kv}
                fmt={(v) => commas(v)}
                snapPoints={CTX_SNAP_POINTS}
              />
              {/* snap labels row */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, paddingTop: 4 }}>
                {[4096, 16384, 32768, 65536, 131072].map(p => {
                  const isActive = context === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setContext(p)}
                      style={{
                        fontFamily: MONO,
                        fontSize: 9.5,
                        color: isActive ? C.kv : C.faint,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "2px 4px",
                        borderRadius: 3,
                        letterSpacing: 0.3,
                        transition: "color 0.15s",
                      }}
                    >
                      {ktok(p)}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: C.faint, marginTop: 8, fontFamily: MONO, lineHeight: 1.6 }}>
                KV = <span style={{ color: C.kv }}>{(m.kvBytesPerTok / 1024).toFixed(0)} KB/token</span>, resident all session
                <br />
                {commas(context)} tok → <span style={{ color: C.kv }}>{gb(m.kv)} GB</span> of KV cache
              </div>
            </Panel>

            {/* RAM */}
            <Panel>
              <div style={{ fontSize: 11.5, color: C.muted, fontFamily: MONO, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
                Unified memory
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {RAM_OPTIONS.map((r) => {
                  const on = r === ram;
                  return (
                    <button
                      key={r}
                      onClick={() => setRamAndCeiling(r)}
                      style={{
                        fontFamily: MONO, fontSize: 12, padding: "8px 12px", borderRadius: 6,
                        border: `1px solid ${on ? C.ceiling : C.line}`,
                        background: on ? "rgba(232,234,237,0.10)" : "transparent",
                        color: on ? C.text : C.muted, cursor: "pointer",
                        transition: "border-color 0.15s, background 0.15s, color 0.15s",
                      }}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                <span style={{ fontSize: 12.5, color: C.muted }}>Usable ceiling</span>
                <span style={{ fontFamily: MONO, fontSize: 13 }}>
                  <NumberInput value={ceiling} onChange={setCeiling} step={0.5} min={2} max={ram} />{" "}
                  <span style={{ color: C.faint }}>GB</span>
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>
                ~{(ram - ceiling).toFixed(1)} GB held back for the OS / wired memory before swap kicks in.
              </div>
            </Panel>

            {/* KV geometry */}
            <Panel>
              <div style={{ fontSize: 11.5, color: C.muted, fontFamily: MONO, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>
                Attention / KV geometry
              </div>
              <div style={{ fontSize: 10.5, color: C.faint, marginBottom: 12, fontFamily: MONO }}>
                KV/token = 2 · layers · kv-heads · head-dim · bytes
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <GeoField label="layers"   value={layers}  onChange={setLayers} />
                <GeoField label="kv heads" value={kvH}     onChange={setKvH} />
                <GeoField label="head dim" value={headDim} onChange={setHeadDim} />
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10.5, color: C.faint, marginBottom: 6, fontFamily: MONO, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  KV precision
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {KVQUANT.map((k) => {
                    const on = k.bytes === kvBytes;
                    return (
                      <button
                        key={k.label}
                        onClick={() => setKvBytes(k.bytes)}
                        style={{
                          flex: 1, fontFamily: MONO, fontSize: 11.5, padding: "6px 0", borderRadius: 6,
                          border: `1px solid ${on ? C.kv : C.line}`,
                          background: on ? "rgba(201,148,46,0.16)" : "transparent",
                          color: on ? C.text : C.muted, cursor: "pointer",
                          transition: "border-color 0.15s, background 0.15s, color 0.15s",
                        }}
                      >
                        {k.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Panel>

            {/* Advanced */}
            <div>
              <button
                onClick={() => setAdv(!adv)}
                style={{
                  fontFamily: MONO, fontSize: 11.5, color: C.muted, background: "none",
                  border: "none", cursor: "pointer", letterSpacing: 1, padding: "2px 0",
                  textTransform: "uppercase",
                  transition: "color 0.15s",
                }}
              >
                {adv ? "▾" : "▸"} runtime &amp; speed
              </button>
              {adv && (
                <Panel style={{ marginTop: 8 }}>
                  <Row label="Runtime overhead" hint="MLX / Metal / server baseline">
                    <NumberInput value={overhead} onChange={setOverhead} step={0.5} min={0} max={12} /> GB
                  </Row>
                  <Row label="Prefill scratch" hint="transient spike while ingesting the prompt">
                    <NumberInput value={scratch} onChange={setScratch} step={0.5} min={0} max={16} /> GB
                  </Row>
                  <div style={{ height: 1, background: C.line, margin: "12px 0" }} />
                  <Row label="Active params" hint="MoE: what actually moves per token → speed">
                    <NumberInput value={active} onChange={setActive} step={0.1} min={0.1} max={params} /> B
                  </Row>
                  <Row label="Memory bandwidth" hint="M5 base ≈ 120 GB/s">
                    <NumberInput value={bandwidth} onChange={setBandwidth} step={10} min={50} max={1000} /> GB/s
                  </Row>
                  <Row label="Decode efficiency" hint="fraction of peak bandwidth realized">
                    <NumberInput value={eff} onChange={setEff} step={0.05} min={0.1} max={0.95} />
                  </Row>
                </Panel>
              )}
            </div>
          </div>

          {/* ──────── RIGHT: READOUT ──────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

            {/* Gauge panel */}
            <Panel>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.muted, letterSpacing: 1, textTransform: "uppercase" }}>
                  Memory budget
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.faint }}>
                  ceiling <span style={{ color: C.ceiling }}>{gb(ceiling)} GB</span> · ram {ram} GB
                </span>
              </div>

              <Gauge
                label="Resident · decode"
                total={m.decode}
                ceiling={ceiling}
                scaleMax={axisMaxScale}
                segs={[
                  { w: m.weights, color: C.weights },
                  { w: m.kv,      color: C.kv      },
                  { w: overhead,  color: C.overhead },
                ]}
              />
              <div style={{ height: 14 }} />
              <Gauge
                label="Peak · prefill"
                total={m.prefill}
                ceiling={ceiling}
                scaleMax={axisMaxScale}
                segs={[
                  { w: m.weights, color: C.weights },
                  { w: m.kv,      color: C.kv      },
                  { w: overhead,  color: C.overhead },
                  { w: scratch,   color: C.scratch, hatch: true },
                ]}
              />

              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 16, fontFamily: MONO, fontSize: 11 }}>
                <Key color={C.weights} label="weights"  v={m.weights} />
                <Key color={C.kv}      label="kv cache" v={m.kv}      />
                <Key color={C.overhead}label="overhead" v={overhead}  />
                <Key color={C.scratch} label="prefill"  v={scratch}  hatch />
              </div>
            </Panel>

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Stat
                label="Decode (resident)" value={gb(m.decode)} unit="GB" ok={m.fitsDecode}
                sub={m.fitsDecode ? `${gb(ceiling - m.decode)} GB to spare` : `over by ${gb(m.decode - ceiling)} GB`}
              />
              <Stat
                label="Prefill (peak)" value={gb(m.prefill)} unit="GB" ok={m.fitsPrefill}
                sub={m.fitsPrefill ? `${gb(ceiling - m.prefill)} GB to spare` : `over by ${gb(m.prefill - ceiling)} GB`}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Stat
                label="Max context · prefill-limited" value={ktok(m.maxCtxPrefill)} unit="tok"
                ok={context <= m.maxCtxPrefill} sub="the wall you actually hit" accent={C.scratch}
              />
              <Stat
                label="Max context · decode-limited" value={ktok(m.maxCtxDecode)} unit="tok"
                ok={context <= m.maxCtxDecode} sub="if you never re-ingest a big prompt" accent={C.kv}
              />
            </div>

            {/* Sweep chart */}
            <Panel>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.muted, letterSpacing: 1, textTransform: "uppercase" }}>
                  Footprint vs context
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>
                  ~{m.tokS.toFixed(0)} tok/s decode{" "}
                  <span style={{ color: C.faint }}>· theoretical</span>
                </span>
              </div>
              <div style={{ width: "100%", height: 230 }}>
                <ResponsiveContainer>
                  <ComposedChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 2 }}>
                    <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
                    <XAxis
                      dataKey="ctx" type="number" domain={[0, "dataMax"]}
                      tickFormatter={ktok} stroke={C.faint}
                      tick={{ fontSize: 10, fontFamily: MONO, fill: C.muted }}
                    />
                    <YAxis
                      domain={[0, yTop]} stroke={C.faint}
                      tick={{ fontSize: 10, fontFamily: MONO, fill: C.muted }}
                      tickFormatter={(v) => v + ""}
                    />
                    <ReferenceArea y1={ceiling} y2={yTop} fill={C.oom} fillOpacity={0.07} />
                    <Tooltip content={<TipBox />} />
                    <Area
                      type="monotone" dataKey="prefill"
                      stroke={C.scratch} strokeWidth={1.5}
                      fill={C.scratch} fillOpacity={0.10}
                      name="prefill peak" dot={false}
                    />
                    <Line
                      type="monotone" dataKey="decode"
                      stroke={C.kv} strokeWidth={1.8}
                      dot={false} name="decode"
                    />
                    <ReferenceLine
                      y={ceiling} stroke={C.oom} strokeWidth={1.4} strokeDasharray="5 3"
                      label={{ value: "ceiling", fill: C.oom, fontSize: 10, fontFamily: MONO, position: "insideTopRight" }}
                    />
                    <ReferenceLine
                      y={ram} stroke={C.faint} strokeDasharray="2 4"
                      label={{ value: ram + " GB", fill: C.faint, fontSize: 9.5, fontFamily: MONO, position: "insideBottomRight" }}
                    />
                    <ReferenceLine
                      x={context} stroke={C.text} strokeOpacity={0.55} strokeWidth={1}
                      label={{ value: "now", fill: C.text, fontSize: 10, fontFamily: MONO, position: "top" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: 11, color: C.faint, marginTop: 6, lineHeight: 1.6 }}>
                Decode footprint clears the ceiling long before the prefill peak does — which is exactly why a
                model can chat fine at a big context, then die the moment you hand it a long prompt.
              </div>
            </Panel>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ marginTop: 40, borderTop: `1px solid ${C.line}`, paddingTop: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>
            Model specs via{" "}
            <a href="https://huggingface.co" target="_blank" rel="noopener noreferrer" style={{ color: C.muted, textDecoration: "none" }}>
              HuggingFace Hub API
            </a>
            {" "}· all math client-side
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>
            Numbers are estimates — validate with{" "}
            <code style={{ color: C.muted }}>mlx_lm.server --model &lt;id&gt;</code>
          </span>
        </div>
      </div>
    </div>
  );
}
