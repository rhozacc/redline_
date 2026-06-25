The headline gauges tell you *whether* a build fits. These are the second-order numbers people rarely work out — the ones that decide whether a setup is actually pleasant to use.

- **Context in plain terms.** Token counts are abstract; words and pages aren't. Roughly **1 token ≈ 0.75 words**, and a page is ~500 words. A 262k-token window is a ~200k-word, ~390-page document held in memory at once.
- **Headroom left.** Not just "does it fit" but *how much room is left* before the redline — how far you can push context (or how much a longer prompt will eat) on this exact build.
- **Download weight.** The quantized weights are also what you pull over the network and store on disk — worth knowing before you start a download on a metered connection.
- **Full-reply time.** tokens/sec only feels real once you turn it into "a 1,000-token answer takes N seconds" — and add TTFT for the pause before it starts.
- **KV share.** What fraction of resident memory is *cache* rather than model. When this gets large, you're paying for context, not capability — a sign to quantize the KV cache or trim the window.

All derived from numbers already on this page — no extra inputs.
