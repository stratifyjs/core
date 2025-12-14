import { expectType } from "tsd";
import { contract, createProvider, ProviderContract } from "..";

// Ports
interface X {
  x: number;
}

interface Y {
  y: number;
}

type XContract = ProviderContract<X>;
type YContract = ProviderContract<Y>;

// Adapters
const x: XContract = createProvider({
  name: "x",
  expose: () => ({ x: 0 }),
});

const xBis: XContract = createProvider({
  name: "x",
  expose: () => ({ x: 1 }),
});

function createYProvider(xDep: XContract): YContract {
  return createProvider({
    name: "y",
    deps: { xDep },
    expose: ({ xDep }) => {
      expectType<{ x: number }>(xDep);
      return { y: xDep.x };
    },
  });
}

const y = createYProvider(x);
expectType<YContract>(y);

const yBis = createYProvider(xBis);
expectType<YContract>(yBis);

interface Greeter {
  greet: (name: string) => string;
}

const GREETER_TOKEN = "greeter";
const Greeter = contract<Greeter>(GREETER_TOKEN);

const PrefixProvider = createProvider({
  name: "prefix",
  expose: () => ({ prefix: "Hello" }),
});

const PrefixGreeter: typeof Greeter = createProvider({
  name: GREETER_TOKEN,
  deps: { prefix: PrefixProvider },
  expose: ({ prefix }) => ({
    greet: (name: string) => `${prefix.prefix}, ${name}!`,
  }),
});

createProvider({
  name: "user",
  deps: { greeter: PrefixGreeter },
  expose({ greeter }) {
    expectType<Greeter>(greeter);
    return greeter.greet("Alice");
  },
});
