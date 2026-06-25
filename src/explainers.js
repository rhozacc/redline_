/* Plain-language explainers, opened from InfoDots.
 *
 * Each `body` is a Markdown string loaded from src/explainers/<key>.md (via Vite's
 * `?raw` import) and rendered with react-markdown in Explainer.jsx. To edit copy,
 * just edit the .md file — no code change needed. To add one: drop a new .md file,
 * import it here, and add an entry with a title. */
import kv from "./explainers/kv.md?raw";
import prefilldecode from "./explainers/prefilldecode.md?raw";
import quant from "./explainers/quant.md?raw";
import kvprec from "./explainers/kvprec.md?raw";
import geometry from "./explainers/geometry.md?raw";
import active from "./explainers/active.md?raw";
import ceiling from "./explainers/ceiling.md?raw";
import bandwidth from "./explainers/bandwidth.md?raw";
import scratch from "./explainers/scratch.md?raw";
import speed from "./explainers/speed.md?raw";
import reality from "./explainers/reality.md?raw";
import optiq from "./explainers/optiq.md?raw";

export const EXPLAINERS = {
  kv:            { title: "KV cache", body: kv },
  prefilldecode: { title: "Prefill vs decode", body: prefilldecode },
  quant:         { title: "Quantization", body: quant },
  kvprec:        { title: "KV cache precision", body: kvprec },
  geometry:      { title: "Attention / KV geometry", body: geometry },
  active:        { title: "Active parameters (MoE)", body: active },
  ceiling:       { title: "Usable ceiling (redline)", body: ceiling },
  bandwidth:     { title: "Memory bandwidth", body: bandwidth },
  scratch:       { title: "Prefill scratch", body: scratch },
  speed:         { title: "Speed: tok/s & TTFT", body: speed },
  reality:       { title: "Reality check", body: reality },
  optiq:         { title: "Why “allegedly”?", body: optiq },
};
