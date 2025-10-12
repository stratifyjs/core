import { describe, test, TestContext } from "node:test";
import {
  createProvider,
  createModule,
  createApp,
  createController,
  createInstaller,
  createHooks,
  createAdapter,
} from "..";

describe("describeTree", () => {
  test("renders module hierarchy with installers, controllers, hooks and deps", async (t: TestContext) => {
    t.plan(1);

    const grandChildProv = createProvider({
      name: "grandChildProv",
      expose: () => ({ x: 1 }),
    });

    const siblingProv = createProvider({
      name: "siblingProv",
      expose: () => ({ y: 2 }),
    });

    const siblingDependent = createProvider({
      name: "siblingDependent",
      deps: { siblingProv },
      expose: ({ siblingProv }) => ({ z: siblingProv.y + 1 }),
    });

    const siblingAdapter = createAdapter({
      name: "siblingAdapter",
      expose: async () => ({
        info: "",
      }),
    });

    const hooksA = createHooks({
      type: "app",
      name: "a",
      deps: { grandChildProv },
      adaps: { siblingAdapter },
      build: async () => {},
    });

    const installerA = createInstaller({
      name: "a",
      deps: { siblingProv },
      install: async () => {},
    });

    const installerB = createInstaller({
      name: "b",
      install: async () => {},
    });

    const controllerA = createController({
      deps: { siblingDependent },
      adaps: { siblingAdapter },
      name: "a",
      build: async () => {},
    });

    const grandChild = createModule({
      name: "grandchild",
      hooks: [hooksA],
    });

    const child = createModule({
      name: "child",
      subModules: [grandChild],
    });

    const sibling = createModule({
      name: "sibling",
      encapsulate: false,
      installers: [installerA, installerB],
      controllers: [controllerA],
    });

    const root = createModule({
      name: "root",
      subModules: [child, sibling],
    });

    const app = await createApp({ root });
    const tree = app.describeTree();

    const expected = String.raw`🌳 mod root@m\d+ \(encapsulate=true\)
  📦 mod child@m\d+ \(encapsulate=true\)
    📦 mod grandchild@m\d+ \(encapsulate=true\)
      🪝 hooks a
        🔌 adp siblingAdapter
        🔧 prov grandChildProv@p\d+
  📦 mod sibling@m\d+ \(encapsulate=false\)
    ⚙️ installer a
      🔧 prov siblingProv@p\d+
    ⚙️ installer b
    🧭 controller a
      🔌 adp siblingAdapter
      🔧 prov siblingDependent@p\d+
        🔧 prov siblingProv@p\d+
`;

console.log(tree)
    // eslint-disable-next-line no-control-regex
    const stripAnsi = (s: string) => s.replace(/\x1B\[[0-9;]*m/g, "");
    t.assert.match(stripAnsi(tree) + "\n", new RegExp(expected));
    await app.close();
  });
});
