Two numbers describe how fast a model feels, and they're governed by different bottlenecks.

### Decode throughput — tokens/sec

How fast the reply streams out once it starts. It's **bandwidth-bound** (see *Memory bandwidth*) and **slowly drops as the KV cache grows**, because there are more bytes to stream per token deeper into a long context.

### Time-to-first-token — TTFT

How long **prefill** takes before the first word appears. It's **compute-bound** (GPU TFLOPS) and **climbs with context**, because attention cost grows quadratically. A short prompt is near-instant; a 200k-token prompt can take many seconds.

### Reading them together

- High tok/s + low TTFT → snappy, interactive.
- Fine tok/s but high TTFT → fast once it gets going, but a long pause on big prompts.

Pick a Mac from the dropdown to see both estimated for your exact build. These are rough — always validate on-device with `mlx_lm.server`.
