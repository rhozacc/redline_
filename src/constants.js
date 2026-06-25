export const C = {
  bg: "#0B0D10",
  panel: "#14181D",
  panel2: "#1B2027",
  line: "#333A44",
  text: "#F1F3F6",
  muted: "#B2B8C2",
  faint: "#7C8590",
  weights: "#5B7A99",
  kv: "#C9942E",
  overhead: "#454C55",
  scratch: "#B5642A",
  ceiling: "#E8EAED",
  oom: "#D23B3B",
  ok: "#5E9C6F",
  warn: "#D9A441",
};

export const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";
export const SANS = "'Inter', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";
export const DISPLAY = "'Chakra Petch', 'JetBrains Mono', monospace";

export const QUANT = [
  { bits: 4,  bpw: 4.25,  label: "4-bit" },
  { bits: 5,  bpw: 5.25,  label: "5-bit" },
  { bits: 6,  bpw: 6.25,  label: "6-bit" },
  { bits: 8,  bpw: 8.5,   label: "8-bit" },
  { bits: 16, bpw: 16,    label: "fp16"  },
];

export const KVQUANT = [
  { bytes: 2,   label: "fp16"  },
  { bytes: 1,   label: "8-bit" },
  { bytes: 0.5, label: "4-bit" },
];

export const RAM_OPTIONS = [16, 24, 32, 48, 64, 96, 128];

// Apple Silicon specs. Memory bandwidth (bw, GB/s) is scraped from Wikipedia at
// build time — see scripts/fetch-mac-specs.mjs / `npm run fetch-specs`. fp16 GPU
// compute (tflops) is a community estimate; Apple does not publish it. Drives
// decode (bandwidth-bound) and prefill (compute-bound) speed.
import macSpecsData from "./macSpecs.json";

export const MAC_SPECS = macSpecsData.chips.map((c) => ({
  name: c.name,
  bw: c.bw,
  tflops: c.tflops,
}));
// provenance for the UI caption (source URLs + fetch date)
export const MAC_SPECS_META = {
  fetchedAt: macSpecsData.fetchedAt,
  source: macSpecsData.source,
};
export const PREFILL_EFF = 0.35; // fraction of peak FLOPs realized during prefill

// Common context sizes that slider should snap to
export const CTX_SNAP_POINTS = [
  1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576,
];
// Snap radius in tokens — if within this distance, snap
export const CTX_SNAP_RADIUS = 0.04; // fraction of total range

export const PRESETS = [
  { name: "Coder-30B-A3B",   note: "current", params: 30.5, q: 4, layers: 48, kvH: 4,  headDim: 128, active: 3.3  },
  { name: "Qwen3.6-35B-A3B", note: "MoE",     params: 35,   q: 4, layers: 40, kvH: 2,  headDim: 256, active: 3    },
  { name: "Qwen3-8B",        note: "small",   params: 8,    q: 4, layers: 36, kvH: 8,  headDim: 128, active: 8    },
  { name: "Gemma-3-27B",     note: "dense",   params: 27,   q: 4, layers: 46, kvH: 16, headDim: 256, active: 27   },
  { name: "Mistral-8x7B",    note: "MoE",     params: 46.7, q: 4, layers: 32, kvH: 8,  headDim: 128, active: 12.9 },
];
