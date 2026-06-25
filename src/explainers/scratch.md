**Prefill scratch** is a transient pool of memory the runtime needs *while ingesting a prompt* — attention score matrices and intermediate activations that exist only during the prefill pass and are freed the moment decode begins.

### Why it matters even though it's temporary

It stacks **on top of** the resident footprint (weights + KV + overhead), which is why **peak memory (prefill) sits above steady-state memory (decode)**.

The consequence is the most common surprise in local inference: a model whose steady state fits comfortably can still **overflow the redline during the spike** when you hand it a long prompt — then run fine again once it's past prefill. You're not sized for the average; you're sized for that peak.

Its size scales with how much context you ingest at once, so the cheapest fix when the spike overflows is to feed the prompt in smaller pieces.
