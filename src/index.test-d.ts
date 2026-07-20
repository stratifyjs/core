import { expectType } from "tsd";
import { createApp, createModule, createProvider, type IocContainer } from ".";

const usersProvider = createProvider({
  name: "users",
  expose: () => ({
    find: () => ["Alice"],
  }),
});
const root = createModule({ name: "root" });
const app = await createApp({ root });

expectType<IocContainer>(app.ioc);
expectType<{ find: () => string[] }>(await app.ioc.get(usersProvider));
expectType<unknown>(await app.ioc.get("users"));
expectType<{ find: () => string[] }>(
  await app.ioc.get<{ find: () => string[] }>("users"),
);
