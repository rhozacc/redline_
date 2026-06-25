import React from "react";
import { C, MONO, SANS, DISPLAY } from "./constants.js";
import { InfoDot } from "./Explainer.jsx";

/* ───────────────────────── schematics (inline SVG, borderless) ───────────────────────── */

function Figure({ children, caption }) {
  return (
    <figure style={{ margin: "16px 0 0" }}>
      {children}
      <figcaption style={{ fontFamily: SANS, fontSize: 11.5, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>{caption}</figcaption>
    </figure>
  );
}

const HatchDef = () => (
  <defs>
    <pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill={C.scratch} />
      <rect width="3" height="6" fill="#8a4d20" />
    </pattern>
  </defs>
);

function BudgetSchematic() {
  const segs = [
    { w: 38, c: C.weights, label: "weights" },
    { w: 26, c: C.kv, label: "KV cache" },
    { w: 9, c: C.overhead, label: "overhead" },
    { w: 15, c: C.scratch, label: "prefill", hatch: true },
  ];
  let x = 0;
  const redline = 82;
  return (
    <Figure caption="One pool. Weights are fixed, the KV cache grows with context, prefill is a temporary spike on top. Cross the redline and the Mac swaps to disk.">
      <svg viewBox="0 0 320 92" width="100%" style={{ display: "block" }}>
        <HatchDef />
        <rect x="0" y="20" width="320" height="34" rx="6" fill={C.panel2} stroke={C.line} />
        {segs.map((s) => {
          const px = (x / 100) * 320, pw = (s.w / 100) * 320;
          x += s.w;
          return (
            <g key={s.label}>
              <rect x={px} y="20" width={pw} height="34" fill={s.hatch ? "url(#hatch)" : s.c} opacity={0.92} />
              <text x={px + pw / 2} y="40" textAnchor="middle" fontFamily={MONO} fontSize="7.5" fill="#0B0D10" fontWeight="700">{s.label}</text>
            </g>
          );
        })}
        <line x1={(redline / 100) * 320} y1="10" x2={(redline / 100) * 320} y2="64" stroke={C.oom} strokeWidth="2" strokeDasharray="4 3" />
        <text x={(redline / 100) * 320} y="78" textAnchor="middle" fontFamily={MONO} fontSize="8" fill={C.oom}>redline</text>
      </svg>
    </Figure>
  );
}

function KvGrowthSchematic() {
  return (
    <Figure caption="Double the context, double the KV cache. It stays resident the whole session.">
      <svg viewBox="0 0 320 120" width="100%" style={{ display: "block" }}>
        <line x1="34" y1="100" x2="310" y2="100" stroke={C.line} />
        <line x1="34" y1="12" x2="34" y2="100" stroke={C.line} />
        <text x="6" y="20" fontFamily={MONO} fontSize="8" fill={C.faint}>GB</text>
        <text x="296" y="114" fontFamily={MONO} fontSize="8" fill={C.faint}>ctx →</text>
        <polygon points="34,100 310,40 310,100" fill={C.kv} opacity="0.16" />
        <line x1="34" y1="100" x2="310" y2="40" stroke={C.kv} strokeWidth="2" />
        {[["32k", 130, 71], ["256k", 230, 49]].map(([l, cx, cy]) => (
          <g key={l}>
            <circle cx={cx} cy={cy} r="3" fill={C.kv} />
            <text x={cx} y={cy - 7} textAnchor="middle" fontFamily={MONO} fontSize="7.5" fill={C.muted}>{l}</text>
          </g>
        ))}
      </svg>
    </Figure>
  );
}

function SpikeSchematic() {
  return (
    <Figure caption="Decode is flat and resident. Prefill is a spike when you load a prompt — and it's usually the spike that clears the redline first.">
      <svg viewBox="0 0 320 120" width="100%" style={{ display: "block" }}>
        <line x1="34" y1="100" x2="310" y2="100" stroke={C.line} />
        <line x1="34" y1="12" x2="34" y2="100" stroke={C.line} />
        <line x1="34" y1="44" x2="310" y2="44" stroke={C.oom} strokeWidth="1.5" strokeDasharray="4 3" />
        <text x="306" y="40" textAnchor="end" fontFamily={MONO} fontSize="8" fill={C.oom}>redline</text>
        <line x1="34" y1="72" x2="310" y2="72" stroke={C.kv} strokeWidth="2" />
        <text x="40" y="68" fontFamily={MONO} fontSize="7.5" fill={C.kv}>decode (resident)</text>
        <path d="M120,72 L150,30 L180,72" fill={C.scratch} opacity="0.18" />
        <path d="M120,72 L150,30 L180,72" fill="none" stroke={C.scratch} strokeWidth="2" />
        <text x="150" y="24" textAnchor="middle" fontFamily={MONO} fontSize="7.5" fill={C.scratch}>prefill spike</text>
      </svg>
    </Figure>
  );
}

/* ───────────────────────── name anatomy ───────────────────────── */

const NAME_PARTS = [
  { t: "qwen3.6", c: C.muted,   k: "family · version", d: "the lineage and release. Sets the capability baseline — newer is usually smarter at the same size." },
  { t: "35b",     c: C.weights, k: "total parameters", d: "35B weights → memory footprint. The number that decides whether it loads at all." },
  { t: "a4b",     c: C.scratch, k: "active params (MoE)", d: "~4B of the 35B actually run per token → decode speed. You pay 35B of RAM but generate like a 4B model." },
  { t: "optiq",   c: C.kv,      k: "quant method", d: "a mixed-precision scheme: sensitive layers kept higher-bit, the rest squeezed. More quality per byte than flat quant." },
  { t: "4bit",    c: C.weights, k: "precision", d: "bits per weight. 4-bit ≈ ¼ the size of fp16 — big RAM saving, small quality cost." },
];

function ModelName() {
  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
        Reading a model name
      </div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 22, letterSpacing: 0.5, lineHeight: 1.2, marginBottom: 14, wordBreak: "break-word" }}>
        {NAME_PARTS.map((p, i) => (
          <React.Fragment key={p.t}>
            {i > 0 && <span style={{ color: C.faint }}>-</span>}
            <span style={{ color: p.c }}>{p.t}</span>
          </React.Fragment>
        ))}
      </div>
      <div>
        {NAME_PARTS.map((p) => (
          <div key={p.t} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "7px 0", borderTop: `1px solid ${C.line}55` }}>
            <span style={{ fontFamily: MONO, fontSize: 12.5, color: p.c, flexShrink: 0, width: 72 }}>{p.t}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{p.k}</div>
              <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
                {p.d}
                {p.t === "optiq" && <> <em style={{ color: C.muted }}>Allegedly.</em><InfoDot k="optiq" /></>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontFamily: SANS, fontSize: 12, color: C.faint, margin: "14px 0 0", lineHeight: 1.55 }}>
        The trade in one line: <span style={{ color: C.weights }}>35b</span> costs the memory,{" "}
        <span style={{ color: C.scratch }}>a4b</span> buys back the speed, and{" "}
        <span style={{ color: C.kv }}>optiq·4bit</span> shrinks it to fit — at a little quality.
      </p>
    </div>
  );
}

/* ───────────────────────── worked memory example ───────────────────────── */

/* 35B @ 4-bit, 128k ctx, on a 32 GB Mac (≈29 GB usable) */
function MemoryExample() {
  // weights 18.6 · KV 10.7 · overhead 2.5 · prefill scratch 6.5  (GB)
  const segs = [
    { v: 18.6, c: C.weights, label: "weights 18.6" },
    { v: 10.7, c: C.kv, label: "KV 10.7" },
    { v: 2.5, c: C.overhead, label: "ovh 2.5" },
    { v: 6.5, c: C.scratch, label: "prefill 6.5", hatch: true },
  ];
  const ceiling = 29, scaleMax = 40, W = 320;
  const px = (gb) => (gb / scaleMax) * W;
  let acc = 0;
  const redX = px(ceiling);
  const prefillEnd = px(18.6 + 10.7 + 2.5 + 6.5);
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
        Worked example
      </div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 12 }}>
        35B · 4-bit · 128k context, on a 32 GB Mac
      </div>
      <svg viewBox="0 0 320 92" width="100%" style={{ display: "block" }}>
        <HatchDef />
        <rect x="0" y="20" width={W} height="34" rx="6" fill={C.panel2} stroke={C.line} />
        {/* over-the-redline zone */}
        <rect x={redX} y="20" width={prefillEnd - redX} height="34" fill={C.oom} opacity="0.14" />
        {segs.map((s) => {
          const x = px(acc), w = px(s.v); acc += s.v;
          return (
            <g key={s.label}>
              <rect x={x} y="20" width={w} height="34" fill={s.hatch ? "url(#hatch)" : s.c} opacity={0.92} />
              <text x={x + w / 2} y="40" textAnchor="middle" fontFamily={MONO} fontSize="7" fill="#0B0D10" fontWeight="700">{s.label}</text>
            </g>
          );
        })}
        <line x1={redX} y1="10" x2={redX} y2="64" stroke={C.oom} strokeWidth="2" strokeDasharray="4 3" />
        <text x={redX} y="78" textAnchor="middle" fontFamily={MONO} fontSize="8" fill={C.oom}>redline 29</text>
      </svg>
      <p style={{ fontFamily: SANS, fontSize: 13, color: C.muted, marginTop: 12, lineHeight: 1.6 }}>
        Weights <strong style={{ color: C.text }}>18.6</strong> + KV cache <strong style={{ color: C.text }}>10.7</strong> + overhead
        2.5 = <strong style={{ color: C.text }}>31.8 GB</strong> just sitting there — already past the ~29 GB redline before the
        6.5 GB prefill spike. <strong style={{ color: C.oom }}>It won't load.</strong> The KV cache at 128k is the culprit: cut
        context to about 16k, or quantize the KV cache to 8-bit, and it fits.
      </p>
    </div>
  );
}

/* ───────────────────────── building blocks ───────────────────────── */

function GlossRow({ color, term, role }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "5px 0" }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color, flexShrink: 0, transform: "translateY(1px)" }} />
      <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.text, flexShrink: 0, width: 96 }}>{term}</span>
      <span style={{ fontFamily: SANS, fontSize: 12.5, color: C.muted, lineHeight: 1.45 }}>{role}</span>
    </div>
  );
}

function Section({ n, title, accent, children }) {
  return (
    <section style={{ marginTop: 34 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: DISPLAY, fontSize: 12, fontWeight: 700, color: accent, letterSpacing: 1 }}>{n}</span>
        <span style={{ width: 16, height: 1, background: C.line }} />
        <h2 style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: 0.3, margin: 0 }}>{title}</h2>
      </div>
      <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>{children}</div>
    </section>
  );
}

const code = (t) => <code style={{ fontFamily: MONO, fontSize: 12.5, color: C.kv }}>{t}</code>;

/* ───────────────────────── page ───────────────────────── */

export default function ExplainerPage() {
  return (
    <div className="reveal" style={{ animationDelay: "0.1s", maxWidth: 760, marginTop: 30 }}>
      <p style={{ fontFamily: SANS, fontSize: 15, color: C.text, lineHeight: 1.55, borderTop: `1px solid ${C.line}`, paddingTop: 26 }}>
        Redline answers one question: will a model fit on your Mac, and how fast will it run.
        Apple Silicon shares one pool of memory between macOS, the GPU, and the model, so fitting
        is a budgeting problem. Here's everything in play and what each part does.
      </p>

      <ModelName />
      <MemoryExample />

      {/* high-level map */}
      <div style={{ marginTop: 30 }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.kv, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
          Fills the memory pool
        </div>
        <GlossRow color={C.weights} term="weights" role="the model itself. Size = parameters × bits-per-weight. Fixed." />
        <GlossRow color={C.kv} term="KV cache" role="notes the model keeps on every token it has read. Grows with context. The part that bites." />
        <GlossRow color={C.overhead} term="overhead" role="runtime and OS baseline. Small, fixed." />
        <GlossRow color={C.scratch} term="prefill scratch" role="temporary spike while reading a prompt. Gone once it replies." />
        <GlossRow color={C.oom} term="redline" role="your usable ceiling. Cross it and the Mac swaps to disk." />

        <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.ok, letterSpacing: 2, textTransform: "uppercase", margin: "18px 0 4px" }}>
          Sets the speed
        </div>
        <GlossRow color={C.kv} term="bandwidth" role="GB/s. Decode rereads everything each token, so this caps tokens/sec." />
        <GlossRow color={C.weights} term="GPU compute" role="TFLOPS. Sets prefill time — how long until the first token." />
        <GlossRow color={C.scratch} term="active params" role="for MoE, what actually runs per token. Big model, fast decode." />
        <GlossRow color={C.weights} term="quantization" role="fewer bits per weight. Smaller model, more room for context." />
      </div>

      <Section n="01" title="One pool" accent={C.ceiling}>
        <p style={{ margin: 0 }}>
          A discrete GPU has its own VRAM. Apple Silicon doesn't — one pool of unified memory
          serves macOS, the GPU, and the model at once. Everything above draws from the same budget,
          so anything you give the model is memory the system can't use.
        </p>
        <BudgetSchematic />
      </Section>

      <Section n="02" title="Weights & quantization" accent={C.weights}>
        <p style={{ margin: 0 }}>
          The weights are the model — its learned numbers. Their size is parameters × bits each.
          Quantization stores those numbers in fewer bits: 4-bit is about a quarter the size of the
          original 16-bit, for a small drop in quality. That saving is what frees room for more
          context, so 4-bit is the usual pick for local use.
        </p>
      </Section>

      <Section n="03" title="The KV cache — what it actually is" accent={C.kv}>
        <p style={{ margin: 0 }}>
          To produce the next word, the model has to look back at every earlier token. Re-reading the
          whole conversation each step would be hopelessly slow, so instead it writes a short note
          about each token the first time it sees it — two small vectors called a <strong style={{ color: C.text }}>key</strong> and
          a <strong style={{ color: C.text }}>value</strong> — and keeps that stack of notes in memory. That stack is the KV cache.
        </p>
        <p style={{ margin: "12px 0 0" }}>
          There's one note per token, per layer, and it stays in memory until the chat ends. So the
          cache starts tiny and grows with every token read or written — a long document or a long
          conversation builds a big one, sitting in the same RAM as the weights. That steady growth
          is why a model can feel fine early on and then choke once the context gets large.
        </p>
        <KvGrowthSchematic />
      </Section>

      <Section n="04" title="What sets the KV size" accent={C.kv}>
        <p style={{ margin: 0 }}>
          The cost of one token's note is {code("2 × layers × kv-heads × head-dim × bytes")}: more
          layers or kv-heads means a fatter note. Modern models share a few kv-heads across many
          query heads (grouped-query attention) to keep that note small — that's what makes long
          context affordable. You can also store the notes in fewer bits (8- or 4-bit) to shrink them further.
        </p>
      </Section>

      <Section n="05" title="Prefill vs decode" accent={C.scratch}>
        <p style={{ margin: 0 }}>
          Running a model has two phases. <strong style={{ color: C.text }}>Prefill</strong> reads your
          whole prompt in one pass to build its KV notes — limited by raw GPU math, and it needs
          extra scratch memory, so memory peaks here. <strong style={{ color: C.text }}>Decode</strong> then
          writes the reply one token at a time — limited by memory speed, and it sets your tokens/sec.
          A model can decode fine at a long context and still fail the instant a big prompt hits prefill.
        </p>
        <SpikeSchematic />
      </Section>

      <Section n="06" title="The redline" accent={C.oom}>
        <p style={{ margin: 0 }}>
          You can't hand the model all your RAM — macOS and everything else need their share. Past a
          safe ceiling the Mac starts swapping memory to disk and speed collapses. That ceiling is the
          redline: a few GB under total RAM, lower if other apps are open.
        </p>
      </Section>

      <Section n="07" title="Speed" accent={C.ok}>
        <p style={{ margin: 0 }}>
          Decode reads the active weights plus the whole KV cache for every token, so its speed is set
          by memory bandwidth and drops as the cache grows. Time-to-first-token is the prefill pass:
          set by GPU compute, and it climbs with context because attention work grows quadratically.
          Bandwidth and compute vary roughly 10× across the lineup — most of why one Mac feels instant
          and another crawls.
        </p>
      </Section>

      <Section n="08" title="MoE & active params" accent={C.weights}>
        <p style={{ margin: 0 }}>
          A Mixture-of-Experts model routes each token through a few small expert sub-networks instead
          of all of them. Total params still set the memory footprint — every expert has to be loaded —
          but only the active ones run per token, so they set decode speed. A 30B-A3B model is large in
          RAM but generates like a 3B.
        </p>
      </Section>

      <p style={{ fontFamily: MONO, fontSize: 11, color: C.faint, marginTop: 38, paddingTop: 18, borderTop: `1px solid ${C.line}`, lineHeight: 1.6 }}>
        Numbers are estimates — validate on-device with {code("mlx_lm.server --model <id>")}.
        Tap <span style={{ color: C.muted }}>[ ← BACK ]</span> to try them.
      </p>
    </div>
  );
}
