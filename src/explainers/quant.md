Weights are trained as 16-bit floats. **Quantization** stores them in fewer bits — 8, 6, 5, or 4 — shrinking the model roughly proportionally. A 4-bit model is about **¼ the size** of fp16.

### The trade

- **fp16** — full size (1×), reference quality.
- **8-bit** — ~½ the size, near-lossless.
- **4-bit** — ~¼ the size, the local-inference sweet spot.

Smaller weights free up headroom for **more context** (a bigger KV cache budget) or simply let a bigger model fit at all. The cost is some loss of quality — but for most local work 4-bit is close enough that the extra headroom is the better trade.

### On a Mac specifically

Because weights and KV cache share one memory pool, dropping from fp16 to 4-bit doesn't just shrink the download — it directly buys you tokens of context you couldn't otherwise afford.
