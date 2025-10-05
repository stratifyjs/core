import Fastify from "fastify";
import fp from "fastify-plugin";
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
const app = Fastify();

function createHttpPlugin(domainIndex) {
  return fp(
    async (instance) => {
      forEachDependencies(domainIndex, (name) => {
        instance.register(
          fp(
            async (instance) =>
              instance.decorate(name, createServiceSample(name)),
            { name },
          ),
        );
      });

      attachPingRoute(instance, instance, domainIndex);
    },
    { name: `http-${domainIndex}`, encapsulate: true },
  );
}

// Because we create metricsModule with fastify-di
function createMetricsPlugin() {
  return async (instance) => {
    attachMetricsRoute(instance, {
      startNs,
      variantLabel: "fastify-native:baseline",
      counts: {
        domains: NUMBER_OF_DOMAINS,
        servicesPerDomain: SERVICES_PER_DOMAIN,
        totalServices: NUMBER_OF_DOMAINS * SERVICES_PER_DOMAIN,
      },
    });
  };
}

forEachDomain((i) => app.register(createHttpPlugin(i)));

app.register(createMetricsPlugin());

await listen(app);
