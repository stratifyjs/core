import v8 from "node:v8";

// eslint-disable-next-line no-undef
const proc = process

export const PORT = 3210;

export const NUMBER_OF_DOMAINS = 200;
export const SERVICES_PER_DOMAIN = 5;

export const TRANSIENT_SERVICES_PER_REQUEST = 1000;

export function createServiceSample(id) {
  return {
    id,
    state: { counter: 0 },
    increment() {
      this.state.counter++;
    },
  };
}

export function forEachDependencies(domainIndex, cb) {
  for (let i = 0; i < SERVICES_PER_DOMAIN; i++) {
    const name = `svc-${domainIndex}-${i}`;
    cb(name);
  }
}

export function forEachDomain(cb) {
  for (let i = 0; i < NUMBER_OF_DOMAINS; i++) {
    cb(i);
  }
}

export async function listen(app) {
  await app.listen({ port: PORT, host: "127.0.0.1" });
  proc.on("SIGTERM", async () => {
    await app.close();
    proc.exit(0);
  });
}

export function attachPingRoute(app, depsMap, domainIndex) {
  app.get(`/ping/${domainIndex}`, async () => {
    let accumulator = 1;
    for (let s = 0; s < SERVICES_PER_DOMAIN; s++) {
      const svc = depsMap[`svc-${domainIndex}-${s}`];
      svc.increment();
    }
    return { pong: true, accumulator };
  });
}

export function attachMetricsRoute(fastify, { startNs, variantLabel, counts }) {
  fastify.get("/__bench/metrics", async () => {
    // eslint-disable-next-line no-undef
    global.gc?.();

    const mem = proc.memoryUsage();
    const heap = v8.getHeapStatistics();
    const ru = proc.resourceUsage()
    const readyNs = Number(proc.hrtime.bigint() - startNs);

    return {
      readyNs,
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
        heapLimit: heap.heap_size_limit,
      },
      resourceUsage: {
        userCPU: ru.userCPUTime,
        systemCPU: ru.systemCPUTime,
        maxRSS: ru.maxRSS,
      },
      variant: variantLabel,
      count: counts,
      pid: proc.pid,
    };
  });
}
