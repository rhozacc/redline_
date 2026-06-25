A **Mixture-of-Experts (MoE)** model has many total parameters but routes each token through only a few small "expert" sub-networks. **Active params** = what actually moves through memory per token.

### Two numbers, two effects

- **Total params** set the **memory footprint** — every expert has to be resident, even the ones a given token doesn't use.
- **Active params** set the **decode speed** — only the routed experts get streamed per token.

That's why a model like **30B-A3B** (30B total, ~3B active) is *big in RAM but fast to generate*: you pay for 30B of weights but only stream ~3B per token.

### The catch

MoE buys you speed, not memory. It doesn't help you fit — if anything the full expert set makes the footprint larger than a dense model of equivalent active size. Great when you have the RAM and want throughput; no help when you're already over the redline.
