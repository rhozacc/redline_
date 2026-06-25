/*
 * Build-time scraper: pulls Apple-Silicon *memory bandwidth* from Wikipedia and
 * writes src/macSpecs.json. Run with:  npm run fetch-specs
 *
 * Why this exists: the bandwidth numbers must come from a citable source, not be
 * typed in from memory. Memory bandwidth IS published on Wikipedia. fp16 GPU
 * TFLOPS is NOT (Apple never publishes it), so those stay community estimates,
 * clearly flagged with `tflopsEstimated: true`.
 */
import { load } from "cheerio";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PAGES = ["Apple M1", "Apple M2", "Apple M3", "Apple M4", "Apple M5"];
const UA = { headers: { "User-Agent": "redline-spec-fetch/1.0 (https://github.com/redline; build-time spec snapshot)" } };

// Canonical display order. A variant only ships if Wikipedia actually lists it
// (e.g. there is intentionally no M4 Ultra / M5 Ultra).
const ORDER = [
  "M1", "M1 Pro", "M1 Max", "M1 Ultra",
  "M2", "M2 Pro", "M2 Max", "M2 Ultra",
  "M3", "M3 Pro", "M3 Max", "M3 Ultra",
  "M4", "M4 Pro", "M4 Max",
  "M5", "M5 Pro", "M5 Max",
];

// fp16 TFLOPS — community estimates (Apple does not publish). Roughly scaled by
// GPU core count / generation. Flagged as estimated in the output.
const TFLOPS_ESTIMATES = {
  "M1": 2.6, "M1 Pro": 5.2, "M1 Max": 10.4, "M1 Ultra": 21,
  "M2": 3.6, "M2 Pro": 6.8, "M2 Max": 13.6, "M2 Ultra": 27,
  "M3": 4.1, "M3 Pro": 7, "M3 Max": 14, "M3 Ultra": 28,
  "M4": 8.5, "M4 Pro": 17, "M4 Max": 34,
  "M5": 10, "M5 Pro": 20, "M5 Max": 42,
};

async function bandwidthFromPage(page) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json&formatversion=2`;
  const res = await fetch(url, UA);
  if (!res.ok) throw new Error(`Wikipedia API ${res.status} for ${page}`);
  const json = await res.json();
  if (!json.parse?.text) throw new Error(`No parse output for ${page}`);
  const $ = load(json.parse.text);

  const found = {};
  $("table").each((_, t) => {
    if (!/GB\/s/.test($(t).text())) return;                  // must mention bandwidth
    if (!/Variant/i.test($(t).find("tr").first().text())) return; // must be a variant table
    let cur = null;
    $(t).find("tr").slice(1).each((__, row) => {
      const first = $(row).find("th,td").first().text().trim().replace(/\s+/g, " ");
      const mn = first.match(/^(M\d+(?:\s+(?:Pro|Max|Ultra))?)\b/);
      if (mn) cur = mn[1];          // rowspan: name persists across sub-rows
      if (!cur) return;
      const bws = [...$(row).text().matchAll(/([\d.]+)\s*GB\/s/gi)].map((m) => parseFloat(m[1]));
      if (bws.length) {
        const mx = Math.max(...bws);          // headline (full, not binned) variant
        found[cur] = Math.max(found[cur] || 0, mx);
      }
    });
  });
  return found;
}

async function main() {
  const bandwidth = {};
  for (const page of PAGES) {
    const got = await bandwidthFromPage(page);
    Object.assign(bandwidth, got);
    console.error(`  ${page}: ${Object.keys(got).join(", ") || "(nothing)"}`);
  }

  const chips = ORDER
    .filter((name) => bandwidth[name] != null)
    .map((name) => ({
      name,
      bw: Math.round(bandwidth[name]),        // GB/s, from Wikipedia
      tflops: TFLOPS_ESTIMATES[name] ?? null, // fp16, community estimate
      tflopsEstimated: true,
    }));

  const missing = ORDER.filter((n) => bandwidth[n] == null);
  if (missing.length) console.error(`  note: not found on wiki: ${missing.join(", ")}`);

  const out = {
    source: PAGES.map((p) => `https://en.wikipedia.org/wiki/${p.replace(/ /g, "_")}`),
    fetchedAt: new Date().toISOString().slice(0, 10),
    note: "bandwidth (bw, GB/s) scraped from Wikipedia variant tables. tflops are community fp16 estimates — Apple does not publish them.",
    chips,
  };

  const dst = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "macSpecs.json");
  writeFileSync(dst, JSON.stringify(out, null, 2) + "\n");
  console.error(`\nWrote ${chips.length} chips → ${dst}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
