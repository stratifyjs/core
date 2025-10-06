import { Type } from "@sinclair/typebox";
import { createModule } from "../modules";
import { expectType } from "tsd";

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
      handler: async (req) => {
        expectType<{ name: string }>(req.body);
        expectType<{ userId: string }>(req.params);
        expectType<{ verbose?: boolean }>(req.query);
        expectType<string>(req.headers.authorization);
      },
    });
  },
});
