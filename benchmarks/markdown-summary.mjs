const BYTES_PER_MB = 1024 * 1024;
const NS_PER_MS = 1e6;

/**
 * Convert nanoseconds to milliseconds.
 */
const nsToMs = (ns) => ns / NS_PER_MS;

/**
 * Format a number with fixed digits and US-style commas.
 */
const formatNumber = (num, digits = 2) =>
  typeof num === "number"
    ? num.toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : String(num);

/**
 * Compute percentage difference (Δ%) between new and baseline.
 */
const percentDiff = (newValue, baseValue) =>
  !isFinite(newValue) || !isFinite(baseValue) || baseValue === 0
    ? 0
    : ((newValue - baseValue) / baseValue) * 100;

/**
 * Build a Markdown benchmark summary comparing native vs DI.
 */
export function buildMarkdownSummary(allResults, options = {}) {
  const {
    nativeName,
    diName,
    connections,
    durationSeconds,
    pipelining,
    warmupSeconds,
    nbDomains,
    nbServicesPerDomain,
    jsonPath,
    repeats,
  } = options;

  // Group results by scenario
  const resultsByScenario = {};
  for (const run of allResults) {
    resultsByScenario[run.scenario] ||= {};
    resultsByScenario[run.scenario][run.variant] = run;
  }

  let md = "";
  md += `# Benchmark Summary\n\n`;
  md += `*connections=${connections}, duration=${durationSeconds}s, pipelining=${pipelining}, warmup=${warmupSeconds}s*\n\n`;
  md += `Domains=${nbDomains}, Services per domain=${nbServicesPerDomain}, Total services=${nbDomains * nbServicesPerDomain}\n\n`;
  md += `Repeats=${repeats}\n\n`;

  for (const scenarioId of Object.keys(resultsByScenario)) {
    const scenarioResults = resultsByScenario[scenarioId];
    const native = scenarioResults[nativeName];
    const di = scenarioResults[diName];
    if (!native || !di) continue;

    // Extract metrics
    const bootNativeMs = nsToMs(native.idle.readyNs);
    const bootDiMs = nsToMs(di.idle.readyNs);

    const rpsNative = native.perf.requests.average;
    const rpsDi = di.perf.requests.average;

    const p99Native = native.perf.latency.p99;
    const p99Di = di.perf.latency.p99;

    const rssNativeMb = native.after.memory.rss / BYTES_PER_MB;
    const rssDiMb = di.after.memory.rss / BYTES_PER_MB;

    // Compute deltas
    const deltaRps = percentDiff(rpsDi, rpsNative);
    const deltaP99 = percentDiff(p99Di, p99Native);
    const deltaBoot = percentDiff(bootDiMs, bootNativeMs);
    const deltaRss = percentDiff(rssDiMb, rssNativeMb);

    // Stability info (stddev)
    const stats = { native: native.stats || {}, di: di.stats || {} };

    // --- Summary table ---
    md += `## ${scenarioId}\n\n`;
    md += `| Metric | ${nativeName} | ${diName} | Δ (DI vs Native) |\n`;
    md += `|---|---:|---:|---:|\n`;
    md += `| **Throughput (req/s avg)** | ${formatNumber(rpsNative, 0)} ± ${formatNumber(stats.native.requestsAvgStddev || 0, 0)} | ${formatNumber(rpsDi, 0)} ± ${formatNumber(stats.di.requestsAvgStddev || 0, 0)} | ${formatNumber(deltaRps, 2)}% |\n`;
    md += `| **Latency p99 (ms)** | ${formatNumber(p99Native, 2)} ± ${formatNumber(stats.native.latencyP99Stddev || 0, 2)} | ${formatNumber(p99Di, 2)} ± ${formatNumber(stats.di.latencyP99Stddev || 0, 2)} | ${formatNumber(deltaP99, 2)}% |\n`;
    md += `| **Boot time (ms)** | ${formatNumber(bootNativeMs, 2)} | ${formatNumber(bootDiMs, 2)} | ${formatNumber(deltaBoot, 2)}% |\n`;
    md += `| **RSS (post-run, MB)** | ${formatNumber(rssNativeMb, 2)} | ${formatNumber(rssDiMb, 2)} | ${formatNumber(deltaRss, 2)}% |\n\n`;

    // --- Stability section ---
    md += `**Stability:** σ(req/s) ${formatNumber(stats.native.requestsAvgStddev || 0, 0)}/${formatNumber(stats.di.requestsAvgStddev || 0, 0)} · σ(p99) ${formatNumber(stats.native.latencyP99Stddev || 0, 2)}/${formatNumber(stats.di.latencyP99Stddev || 0, 2)} ms\n\n`;

    // --- Memory breakdown ---
    md += `#### Memory breakdown (avg)**\n\n`;
    md += `| Metric | ${nativeName} | ${diName} |\n|---|---:|---:|\n`;
    md += `| Idle RSS (MB) | ${formatNumber(native.idle.memory.rss / BYTES_PER_MB, 2)} | ${formatNumber(di.idle.memory.rss / BYTES_PER_MB, 2)} |\n`;
    md += `| HeapUsed idle (MB) | ${formatNumber(native.idle.memory.heapUsed / BYTES_PER_MB, 2)} | ${formatNumber(di.idle.memory.heapUsed / BYTES_PER_MB, 2)} |\n`;
    md += `| HeapTotal idle (MB) | ${formatNumber(native.idle.memory.heapTotal / BYTES_PER_MB, 2)} | ${formatNumber(di.idle.memory.heapTotal / BYTES_PER_MB, 2)} |\n`;
    md += `| HeapLimit (MB) | ${formatNumber(native.idle.memory.heapLimit / BYTES_PER_MB, 2)} | ${formatNumber(di.idle.memory.heapLimit / BYTES_PER_MB, 2)} |\n`;
    md += `| HeapUsed after (MB) | ${formatNumber(native.after.memory.heapUsed / BYTES_PER_MB, 2)} | ${formatNumber(di.after.memory.heapUsed / BYTES_PER_MB, 2)} |\n`;
    md += `| HeapTotal after (MB) | ${formatNumber(native.after.memory.heapTotal / BYTES_PER_MB, 2)} | ${formatNumber(di.after.memory.heapTotal / BYTES_PER_MB, 2)} |\n`;
    md += `\n`;

    if (jsonPath) {
      md += `**Raw results:** ${jsonPath}\n\n`;
    }
  }

  md += `> **Fairness protocol:** even repeats with ABBA alternation, fresh process per trial, single GC before memory snapshots, bad trials discarded.\n`;

  return md;
}
