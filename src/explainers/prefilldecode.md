Inference happens in two distinct phases with very different costs.

### Prefill — ingesting your prompt

The model processes **all** of your input tokens in one big parallel pass. It's **compute-bound** (limited by raw GPU math throughput), and it allocates a transient pool of **scratch** memory for attention scores and intermediate activations.

Two consequences:

- It causes a **memory spike** on top of the resident footprint — the peak you have to fit under, not the average.
- Its cost grows **quadratically** with context (attention is N²), so a very long prompt can take seconds before the first word appears.

### Decode — writing the reply

The model generates the answer **one token at a time**. Each step streams the active weights and the *entire* KV cache through memory, so decode is **bandwidth-bound**. This is the number that sets your tokens/sec.

### Why the distinction matters

A model can **decode** fine at a huge context, then **fall over the instant a long prompt triggers the prefill spike**. Decode tells you whether it *runs*; prefill tells you whether you can actually *feed it* the prompt you wanted to. The redline you hit first is almost always prefill.
