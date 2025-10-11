import { Type } from "@sinclair/typebox";
import { createModule } from "../modules";
import { expectType } from "tsd";
import { createController } from "./controllers";

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

const controller = createController({
  build({ builder }) {
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

createModule({
  name: "root",
  controllers: [controller],
});
