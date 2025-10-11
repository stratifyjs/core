import {
  ApplicationHooksBuilderCallback,
  createModule,
  HttpHooksBuilderCallback,
  ProvidersMap,
} from "../modules";
import { expectType } from "tsd";
import { createProvider, ProviderContract } from "../providers";

// Port
interface X {
  foo: number;
}

type XContract = ProviderContract<X>;

// Adapter
const x: XContract = createProvider({
  name: "x",
  expose: () => ({ foo: 0 }),
});

interface XModuleDeps extends ProvidersMap {
  x: XContract;
}

const deps: XModuleDeps = {
  x,
};

const httpHooks: HttpHooksBuilderCallback<XModuleDeps> = ({
  builder,
  deps,
}) => {
  builder.addHook("onRequest", async (req, rep) => {
    expectType<string>(req.ip);
    expectType<boolean>(rep.sent);
    expectType<{ foo: number }>(deps.x);
  });
};

const appHooks: ApplicationHooksBuilderCallback<XModuleDeps> = ({
  builder,
  deps,
}) => {
  builder.addHook("onRoute", async (opts) => {
    expectType<string>(opts.url);
    expectType<{ foo: number }>(deps.x);
  });
};

createModule({
  name: "root",
  deps,
  httpHooks,
  appHooks,
});
