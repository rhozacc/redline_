/* Plain-language explainers, opened from InfoDots. body = array of paragraphs. */
export const EXPLAINERS = {
  kv: {
    title: "KV cache",
    body: [
      "As the model reads your prompt and writes its reply, it stores a \"key\" and \"value\" vector for every token in every layer. That store is the KV cache — it's what lets the model attend to everything that came before without re-reading it.",
      "It lives in memory for the entire session and grows linearly with context: double the context, double the KV cache. On a unified-memory Mac it competes with the model weights for the same RAM — which is the whole story this tool tells.",
    ],
  },
  prefilldecode: {
    title: "Prefill vs decode",
    body: [
      "Prefill is the model ingesting your prompt — it processes all input tokens in one big parallel pass. It's compute-bound (limited by GPU math throughput) and causes a transient memory spike for scratch buffers.",
      "Decode is generating the reply one token at a time. Each step streams the whole model + KV cache through memory, so it's bandwidth-bound. A model can decode fine at a huge context, then run out of memory the instant a long prompt triggers the prefill spike.",
    ],
  },
  quant: {
    title: "Quantization",
    body: [
      "Weights are normally 16-bit floats. Quantization stores them in fewer bits (8, 6, 5, 4…), shrinking the model roughly proportionally — a 4-bit model is ~¼ the size of fp16.",
      "Smaller weights free up headroom for more context, at some cost to quality. 4-bit is the common sweet spot for local inference.",
    ],
  },
  kvprec: {
    title: "KV cache precision",
    body: [
      "The KV cache can also be quantized. Dropping it from fp16 to 8-bit or 4-bit halves or quarters the per-token KV cost — directly buying you more usable context.",
      "It's separate from weight quantization and trades a little attention accuracy for a lot of context headroom.",
    ],
  },
  geometry: {
    title: "Attention / KV geometry",
    body: [
      "KV cache size per token = 2 × layers × kv-heads × head-dim × bytes. More layers or KV heads → a fatter cache per token.",
      "Modern models use grouped-query attention (few kv-heads shared across many query heads) specifically to keep this number small, so long context stays affordable.",
    ],
  },
  active: {
    title: "Active parameters (MoE)",
    body: [
      "Mixture-of-Experts models have many total parameters but only route each token through a few \"expert\" sub-networks. Active params = what actually moves per token.",
      "Total params set the memory footprint; active params set decode speed. That's why a 30B-A3B model is big in RAM but fast to generate.",
    ],
  },
  ceiling: {
    title: "Usable ceiling (redline)",
    body: [
      "Unified memory is shared by the OS, the GPU, and everything else. You can't hand all of it to the model — once you exceed the safe ceiling, macOS starts swapping to disk and inference crawls or crashes.",
      "The ceiling is your redline: the most memory you can actually spend before things fall apart. It's typically a few GB below total RAM.",
    ],
  },
  bandwidth: {
    title: "Memory bandwidth",
    body: [
      "How fast data moves between memory and the GPU, in GB/s. Decode reads the active weights and the full KV cache every single token, so decode speed is almost entirely set by bandwidth.",
      "Roughly: double the bandwidth, double the tokens/sec. It's the headline spec that separates an M-base chip from a Max or Ultra.",
    ],
  },
  scratch: {
    title: "Prefill scratch",
    body: [
      "A transient pool of memory the runtime needs while ingesting a prompt (attention scores, intermediate activations). It appears only during prefill and disappears once decode begins.",
      "It's why peak memory (prefill) sits above resident memory (decode) — and why a long prompt can overflow even when the steady state would fit.",
    ],
  },
  speed: {
    title: "Speed: tok/s & TTFT",
    body: [
      "Decode throughput (tokens/sec) is how fast the reply streams out — bandwidth-bound, and it slowly drops as the KV cache grows.",
      "Time-to-first-token (TTFT) is how long prefill takes before the first word appears — compute-bound, and it climbs with context because attention cost grows quadratically. Pick a Mac to see both estimated for your build.",
    ],
  },
};
