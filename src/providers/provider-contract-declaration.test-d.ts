import { expectType } from "tsd";
import {
  createProvider,
  createModule,
  ProviderContract,
  ModuleDef,
  ModuleAny,
} from "..";

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
      return { y: xDep.x++ };
    },
  });
}

const y = createYProvider(x);
expectType<YContract>(y);

const yBis = createYProvider(xBis);
expectType<YContract>(yBis);

// Modules
function createUsersModule(yDep: YContract) {
  return createModule({
    name: "users",
    deps: { yDep },
    fastifyInstaller({ deps }) {
      expectType<{ y: number }>(deps.yDep);
    },
  });
}

const users = createUsersModule(y);
expectType<
  ModuleDef<
    {
      readonly yDep: YContract;
    },
    readonly ModuleAny[]
  >
>(users);
