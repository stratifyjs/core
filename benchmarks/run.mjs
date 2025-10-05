/* eslint-disable no-undef */
import { spawn } from "node:child_process";
import { join } from "node:path";
import fs from "node:fs";
import autocannon from "autocannon";
import { clearTimeout, setTimeout } from "node:timers";
import { buildMarkdownSummary } from "./markdown-summary.mjs";
import { NUMBER_OF_DOMAINS, PORT, SERVICES_PER_DOMAIN } from "./shared.mjs";

const __dirname = import.meta.dirname;

const TARGET_BASE = `http://127.0.0.1:${PORT}`;
const METRICS_URL = `${TARGET_BASE}/__bench/metrics`;

const DURATION_SECONDS = 10;
const CONNECTIONS = 100;
const PIPELINING = 1;
const WARMUP_SECONDS = 3;
const REPEATS = 30;

const scenarios = [{ id: "baseline", path: "/ping/0" }];

const variants = [
  {
    name: "fastify-native",
    entries: {
      baseline: join(__dirname, "scenarios", "fastify-native", "server.mjs"),
    },
  },
  {
    name: "stratify",
    entries: {
      baseline: join(__dirname, "scenarios", "stratify", "server.mjs"),
    },
  },
];

function buildABBASchedule(variants, repeats) {
  if (variants.length !== 2) {
    throw new Error("This scheduler assumes exactly 2 variants.");
  }

  if (repeats % 2 !== 0) {
    throw new Error("REPEATS must be even to alternate fairly.");
  }

  const [A, B] = variants;
  const schedule = [];

  for (let i = 0; i < repeats; i++) {
    if (i % 2 === 0) {
      schedule.push(A, B); // even round: A then B
    } else {
      schedule.push(B, A); // odd round: B then A
    }
  }

  return schedule;
}

function spawnServer(entryPath) {
  return spawn(process.execPath, ["--expose-gc", entryPath], {
    stdio: ["ignore", "ignore", "inherit"],
  });
}

async function waitForMetrics(url, timeoutMs = 30_000) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    for (;;) {
      try {
        const res = await fetch(url, { signal: abort.signal });
        if (res.ok) {
          return await res.json(); // this includes readyNs and runs global.gc() once
        }
        // eslint-disable-next-line no-empty
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
  } finally {
    clearTimeout(timer);
  }
}

function waitForExit(child, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error("Child did not exit in time")),
      timeoutMs,
    );
    child.once("exit", () => {
      clearTimeout(t);
      resolve();
    });
    child.once("error", (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function httpGetJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function runAutocannon(pathname) {
  const result = await new Promise((resolve, reject) => {
    autocannon(
      {
        url: `${TARGET_BASE}${pathname}`,
        connections: CONNECTIONS,
        duration: DURATION_SECONDS,
        pipelining: PIPELINING,
        warmup: { duration: WARMUP_SECONDS },
      },
      (err, res) => {
        if (err) return reject(err);
        resolve(res);
      },
    );
  });

  return {
    requests: result.requests,
    latency: result.latency,
    throughput: result.throughput,
    errors: result.errors,
    non2xx: result["non2xx"],
    timeouts: result.timeouts,
  };
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
}

function aggregateResultsWithVariance(runs) {
  const first = runs[0];
  const agg = JSON.parse(JSON.stringify(first));

  const rdy = runs.map((r) => r.idle.readyNs);
  const rssIdle = runs.map((r) => r.idle.memory.rss);
  const reqAvg = runs.map((r) => r.perf.requests.average);
  const thrAvg = runs.map((r) => r.perf.throughput.average);
  const latP99 = runs.map((r) => r.perf.latency.p99);
  const rssAfter = runs.map((r) => r.after.memory.rss);

  agg.idle.readyNs = mean(rdy);
  agg.idle.memory.rss = mean(rssIdle);
  agg.perf.requests.average = mean(reqAvg);
  agg.perf.latency.p99 = mean(latP99);
  agg.perf.throughput.average = mean(thrAvg);
  agg.after.memory.rss = mean(rssAfter);

  // add dispersion & quality flags
  agg.stats = {
    n: runs.length,
    requestsAvgStddev: stddev(reqAvg),
    throughputAvgStddev: stddev(thrAvg),
    latencyP99Stddev: stddev(latP99),
    idleReadyNsStddev: stddev(rdy),
    rssIdleStddev: stddev(rssIdle),
    rssAfterStddev: stddev(rssAfter),
    errorsTotal: runs.reduce((s, r) => s + (r.counters?.errors || 0), 0),
    non2xxTotal: runs.reduce((s, r) => s + (r.counters?.non2xx || 0), 0),
    timeoutsTotal: runs.reduce((s, r) => s + (r.counters?.timeouts || 0), 0),
  };

  return agg;
}

async function run() {
  const allResults = [];

  for (const scenario of scenarios) {
    /** @type {Record<string, any[]>} */
    const runsByVariant = {};

    const schedule = buildABBASchedule(variants, REPEATS);
    console.log(`Schedule: ${schedule.map((s) => s.name).join(", ")}`);

    console.log(
      `\n== Scenario: ${scenario.id} | Trials: ${schedule.length} ==`,
    );

    for (let t = 0; t < schedule.length; t++) {
      const variant = schedule[t];
      console.log(
        `  Trial ${t + 1}/${schedule.length} — Variant: ${variant.name}`,
      );

      const entryPath = variant.entries[scenario.id];
      const child = spawnServer(entryPath);

      try {
        // Use the first successful metrics response as idle/boot sample
        const idleMetrics = await waitForMetrics(METRICS_URL);

        const perf = await runAutocannon(scenario.path);

        // One "after" sample (runs GC once)
        const afterMetrics = await httpGetJSON(METRICS_URL);

        (runsByVariant[variant.name] ||= []).push({
          scenario: scenario.id,
          variant: variant.name,
          config: {
            durationSeconds: DURATION_SECONDS,
            connections: CONNECTIONS,
            pipelining: PIPELINING,
            warmupSeconds: WARMUP_SECONDS,
          },
          idle: idleMetrics,
          perf,
          after: afterMetrics,
          counters: {
            errors: perf.errors,
            non2xx: perf.non2xx,
            timeouts: perf.timeouts,
          },
        });
      } finally {
        child.kill("SIGTERM");
        await waitForExit(child);
        await sleep(250);
      }
    }

    // Aggregate per variant
    for (const variant of variants) {
      const runs = runsByVariant[variant.name] || [];
      if (runs.length > 0) {
        const averaged = aggregateResultsWithVariance(runs);
        allResults.push(averaged);
      }
    }
  }

  const outDir = join(__dirname, "results");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  fs.writeFileSync(
    join(outDir, `bench-${stamp}.json`),
    JSON.stringify(allResults, null, 2),
  );
  console.log(`\nWrote results to benchmarks/results/bench-${stamp}.json`);

  const md = buildMarkdownSummary(allResults, {
    nativeName: "fastify-native",
    diName: "stratify",
    connections: CONNECTIONS,
    durationSeconds: DURATION_SECONDS,
    pipelining: PIPELINING,
    warmupSeconds: WARMUP_SECONDS,
    nbDomains: NUMBER_OF_DOMAINS,
    nbServicesPerDomain: SERVICES_PER_DOMAIN,
    repeats: REPEATS
  });

  const mdPath = join(outDir, `bench-${stamp}.md`);
  fs.writeFileSync(mdPath, md, "utf8");
  console.log("\n" + md);
  console.log(`Saved summary to ${mdPath}`);
}

await run();
