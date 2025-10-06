import { Type } from "@sinclair/typebox";
import {
  createModule,
  HttpHooksBuilderCallback,
  ProvidersMap,
  RoutesBuilderCallback,
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

const routes: RoutesBuilderCallback<XModuleDeps> = ({ builder, deps }) => {
  builder.addRoute({
    url: "/",
    method: "GET",
    handler: async (req, rep) => {
      expectType<string>(req.ip);
      expectType<boolean>(rep.sent);
      expectType<{ foo: number }>(deps.x);
    },
  });
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

createModule({
  name: "root",
  deps,
  routes,
  httpHooks,
});

const CreateUserSchema = {
  body: Type.Object({
    name: Type.String(),
  }),
  querystring: Type.Object({
    verbose: Type.Optional(Type.Boolean()),
  }),
  params: Type.Object({
    userId: Type.String(),
  }),
  headers: Type.Object({
    authorization: Type.String(),
  }),
};

createModule({
  name: "root",
  routes({ builder }) {
    builder.addRoute({
      url: "/",
      method: "GET",
      schema: CreateUserSchema,
      handler: async (req, rep) => {
        expectType<{ name: string }>(req.body);
        expectType<{ userId: string }>(req.params);
        expectType<{ verbose?: boolean }>(req.query);
        expectType<string>(req.headers.authorization);

        expectType<string>(req.ip);
        expectType<boolean>(rep.sent);
      },
    });
  },
});
