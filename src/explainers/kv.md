As the model reads your prompt and writes its reply, it stores a **key** and **value** vector for every token, in every layer. That running store is the **KV cache** — it's what lets the model attend to everything that came before without re-reading the whole context each step.

### Why you should actually worry about it

On a normal GPU the weights sit in VRAM and the KV cache is a side concern. On a **unified-memory Mac there is only one pool** — the KV cache competes with the model weights, the OS, and everything else for the *same* RAM. That's the whole story this tool tells.

Three things make it the variable that bites you:

- **It grows linearly with context.** Double the context, double the KV cache. Weights are fixed; KV is the part that balloons.
- **It's resident for the entire session.** Unlike the prefill spike, it never frees — every token you've seen is still being held.
- **It's what turns "fits" into "swaps."** A model can load fine and chat happily at 8k tokens, then cross the redline at 64k purely because the cache caught up with it — and once macOS starts swapping to disk, throughput falls off a cliff.

### A worked number

A 48-layer model with 4 KV heads and head-dim 128 at fp16 costs:

`2 × 48 × 4 × 128 × 2 bytes ≈ 98 KB per token`

At 32k tokens that's ~**3 GB**; at 256k it's ~**25 GB** — often *more than the weights themselves*. That's why the levers that look small (KV precision, kv-heads) move the redline more than anything except quantization.
