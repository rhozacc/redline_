Unified memory is shared by the OS, the window server, the GPU, and every app you have open. You **can't** hand all of it to the model.

### The redline

Past a safe **ceiling**, macOS starts compressing and then **swapping memory to disk**. For inference that's catastrophic — the GPU stalls waiting on storage and tokens/sec collapses (or the process is killed outright). The ceiling is your **redline**: the most memory you can actually spend before things fall apart.

### Where to set it

A common starting point is **a few GB below total RAM** — enough for the OS and whatever else is running:

- 16 GB machine → ~12–13 GB usable
- 32 GB → ~28–29 GB
- 64 GB → ~58–60 GB

Close everything else and you can push it higher; run a browser with 40 tabs and you should pull it down. It's a budget you set, not a hard number the OS reports.
