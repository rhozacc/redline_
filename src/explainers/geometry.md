The per-token size of the KV cache is set entirely by the model's attention shape:

`KV per token = 2 × layers × kv-heads × head-dim × bytes`

The leading `2` is for storing both **K**eys and **V**alues. Everything else is fixed by the architecture (and the `bytes` term is your KV precision choice).

### What moves the number

- **More layers** → proportionally fatter cache.
- **More kv-heads** → proportionally fatter cache.
- **head-dim** → linear as well.

### Why modern models keep it small

Older models used as many KV heads as attention heads. Modern ones use **grouped-query attention (GQA)** — many query heads *share* a handful of kv-heads — specifically to shrink this term so long context stays affordable. A model with 4 kv-heads instead of 32 has an **8× smaller** cache per token, which is why architecture, not just size, decides how far your context can stretch.
