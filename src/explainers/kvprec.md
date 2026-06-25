The KV cache can be quantized too, **independently** of the weights.

Dropping it from fp16 → 8-bit **halves** the per-token KV cost; fp16 → 4-bit **quarters** it. Since the KV cache is the part of memory that grows with context, this is the most direct lever you have for buying **more usable context**.

### What it costs

A little attention accuracy, for a lot of headroom. In practice 8-bit KV is widely used and rarely noticeable; 4-bit is more aggressive but can double your reachable context again.

### Rule of thumb

If you're hitting the redline on context (not on weights), reach for KV quantization **before** you shrink the model — it targets exactly the thing that's overflowing.
