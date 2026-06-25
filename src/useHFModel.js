import { useState, useCallback, useRef } from "react";

const HF_API = "https://huggingface.co/api";

// Extract useful fields from HF model metadata
function parseModelConfig(modelId, siblings, config) {
  const result = { modelId };

  if (!config) return result;

  // params count
  const safetensors = siblings?.find(f => f.rfilename === "model.safetensors.index.json");
  if (config.num_parameters) {
    result.params = config.num_parameters / 1e9;
  }

  // architecture
  const arch = config.architectures?.[0] ?? "";
  result.arch = arch;

  // context length
  const ctx =
    config.max_position_embeddings ??
    config.max_sequence_length ??
    config.sliding_window ??
    null;
  if (ctx) result.contextLength = ctx;

  // KV geometry
  const layers =
    config.num_hidden_layers ??
    config.num_layers ??
    config.n_layer ??
    null;
  if (layers) result.layers = layers;

  const kvH =
    config.num_key_value_heads ??
    config.num_attention_heads ??
    config.n_head ??
    null;
  if (kvH) result.kvH = kvH;

  const headDim =
    config.head_dim ??
    (config.hidden_size && config.num_attention_heads
      ? Math.round(config.hidden_size / config.num_attention_heads)
      : null);
  if (headDim) result.headDim = headDim;

  // MoE — active params estimate
  const numExperts = config.num_experts ?? config.num_local_experts ?? null;
  const topK = config.num_experts_per_tok ?? config.top_k ?? null;
  if (numExperts && topK && result.params) {
    // rough: active ≈ total × (top_k / num_experts)
    result.activeParams = +(result.params * (topK / numExperts)).toFixed(2);
  }

  // model card tags for quant hint
  result.isMoE = !!(numExperts);

  return result;
}

export default function useHFModel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [applying, setApplying] = useState(false);
  const [mlxOnly, setMlxOnlyState] = useState(false);
  const debounceRef = useRef(null);
  // refs so the memoized callbacks always see the latest query / flag
  const queryRef = useRef("");
  const mlxRef = useRef(false);

  // actual fetch — shared by typing and by toggling the mlx filter
  const runSearch = useCallback(async (q, mlx) => {
    if (q.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      let url = `${HF_API}/models?search=${encodeURIComponent(q)}&limit=8&filter=text-generation&sort=downloads&direction=-1`;
      if (mlx) url += "&author=mlx-community"; // restrict to the mlx-community org
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HF API ${res.status}`);
      const models = await res.json();
      setResults(models.map(m => ({
        modelId: m.modelId ?? m.id,
        downloads: m.downloads,
        likes: m.likes,
        tags: m.tags ?? [],
      })));
    } catch (e) {
      setError(e.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback((q) => {
    setQuery(q);
    queryRef.current = q;
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(() => runSearch(q, mlxRef.current), 320);
  }, [runSearch]);

  // flipping the mlx filter immediately re-runs the current query
  const setMlxOnly = useCallback((v) => {
    setMlxOnlyState(v);
    mlxRef.current = v;
    clearTimeout(debounceRef.current);
    if (queryRef.current.trim().length >= 2) runSearch(queryRef.current, v);
  }, [runSearch]);

  const fetchConfig = useCallback(async (modelId) => {
    setApplying(true);
    setError(null);
    try {
      // Try config.json
      const [cfgRes, sibRes] = await Promise.all([
        fetch(`${HF_API}/models/${modelId}`),
      ]);
      if (!cfgRes.ok) throw new Error(`Cannot load ${modelId}`);
      const meta = await cfgRes.json();

      // fetch config.json directly
      let config = null;
      try {
        const cr = await fetch(`https://huggingface.co/${modelId}/resolve/main/config.json`);
        if (cr.ok) config = await cr.json();
      } catch (_) {}

      return parseModelConfig(modelId, meta.siblings, config);
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setApplying(false);
    }
  }, []);

  return { query, search, results, loading, error, applying, fetchConfig, setResults, setQuery, mlxOnly, setMlxOnly };
}
