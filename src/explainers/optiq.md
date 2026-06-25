"More quality per byte" is the pitch for mixed-precision quants like OptiQ: run a sensitivity pass, keep the layers that matter at higher precision, and squeeze the rest harder.

The reason for the *allegedly*: the evidence is mostly the publisher's own benchmarks. Which layers count as "sensitive" depends on the model and the eval, the reported perplexity gains are often tiny, and independent head-to-head tests against a plain 4-bit quant are rare. It may genuinely be better — just read the claim as a claim, not a measurement.
