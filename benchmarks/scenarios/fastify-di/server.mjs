import { createApp, createModule, createProvider } from "stratify";
import {
  attachMetricsRoute,
  attachPingRoute,
  createServiceSample,
  forEachDependencies,
  forEachDomain,
  listen,
  NUMBER_OF_DOMAINS,
  SERVICES_PER_DOMAIN,
} from "../../shared.mjs";

// eslint-disable-next-line no-undef
const startNs = process.hrtime.bigint();

function createHttpModule(domainIndex) {
  const deps = {};
  forEachDependencies(
    domainIndex,
    (name) =>
      (deps[name] = createProvider({
        name,
        expose: () => createServiceSample(name),
      })),
  );

  return createModule({
    name: `http-${domainIndex}`,
    deps,
    accessFastify: ({ fastify, deps }) => {
      attachPingRoute(fastify, deps, domainIndex);
    },
  });
}

function createMetricsModule() {
  return createModule({
    name: "metrics",
    accessFastify: ({ fastify }) => {
      attachMetricsRoute(fastify, {
        startNs,
        variantLabel: "fastify-di:baseline",
        counts: {
          domains: NUMBER_OF_DOMAINS,
          servicesPerDomain: SERVICES_PER_DOMAIN,
          totalServices: NUMBER_OF_DOMAINS * SERVICES_PER_DOMAIN,
        },
      });
    },
  });
}

// Assemble root
const domainModules = [];
forEachDomain((i) => domainModules.push(createHttpModule(i)));

const root = createModule({
  name: "root",
  subModules: [createMetricsModule(), ...domainModules],
});

const app = await createApp({
  root,
});

await listen(app);
