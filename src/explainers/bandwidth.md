Memory bandwidth is how fast data moves between RAM and the GPU, in **GB/s**. It's the single most important spec for local inference speed.

### Why it dominates decode

Generating each token means streaming the active weights **and** the full KV cache through the GPU once. That's a memory-movement problem, not a math problem — so decode throughput is almost entirely set by bandwidth.

Roughly: **double the bandwidth, double the tokens/sec.**

### The spread across Apple Silicon

It's also what most separates the chips. A base chip sits around 100–150 GB/s; a Max is 400–600+; an Ultra pushes ~800. That ~10× spread is why the same model can feel sluggish on one Mac and instant on another.

> Bandwidth figures in this tool are scraped from Wikipedia. fp16 TFLOPS (which drives prefill) is a community estimate — Apple doesn't publish it.
