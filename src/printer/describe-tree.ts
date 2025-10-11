import { AdapterAny } from "../fastify";
import {
  getModuleId,
  type ModuleAny,
} from "../modules";
import {
  getProviderId,
  type ProviderAny,
} from "../providers";

const useColor = process.stdout.isTTY;
const wrap = (code: number, s: string, enabled: boolean) => {
  /* c8 ignore next */
  return enabled ? `\x1b[${code}m${s}\x1b[0m` : s;
};

const createColors = (enabled: boolean) => ({
  dim: (s: string) => wrap(2, s, enabled),
  cyan: (s: string) => wrap(36, s, enabled),
  green: (s: string) => wrap(32, s, enabled),
  yellow: (s: string) => wrap(33, s, enabled),
  magenta: (s: string) => wrap(35, s, enabled),
  blue: (s: string) => wrap(34, s, enabled),
});

export function describeTree(root: ModuleAny): string {
  const lines: string[] = [];
  const c = createColors(useColor);
  const pad = (depth: number) => "  ".repeat(depth);

  function walkProvider(p: ProviderAny, depth: number) {
    const lifeCol =
      p.lifecycle === "transient" ? c.yellow("transient") : c.green("singleton");
    lines.push(
      `${pad(depth)}🔧 ${c.dim("prov")} ${c.cyan(`${p.name}@${getProviderId(p)}`)} [${lifeCol}]`,
    );
    for (const dep of Object.values(p.deps) as ProviderAny[]) {
      walkProvider(dep, depth + 1);
    }
  }

  function walkAdapter(a: AdapterAny, depth: number) {
    lines.push(`${pad(depth)}🔌 ${c.dim("adp")} ${c.magenta(`${a.name}`)}`);
  }

  function walkConfig(
    typeEmoji: string,
    label: string,
    config: { deps: Record<string, unknown>; adaps?: Record<string, unknown> },
    depth: number,
  ) {
    lines.push(`${pad(depth)}${typeEmoji} ${label}`);
    const adaps = config.adaps ?? {};
    const deps = config.deps ?? {};

    for (const a of Object.values(adaps) as AdapterAny[]) {
      walkAdapter(a, depth + 1);
    }

    for (const p of Object.values(deps) as ProviderAny[]) {
      walkProvider(p, depth + 1);
    }
  }

  function walkModule(m: ModuleAny, depth: number, isRoot = false) {
    const emoji = isRoot ? "🌳" : "📦";
    lines.push(
      `${pad(depth)}${emoji} ${c.dim("mod")} ${c.cyan(`${m.name}@${getModuleId(m)}`)} ${c.dim(`(encapsulate=${m.encapsulate !== false})`)}`,
    );

    // hooks
    for (const hook of (m.hooks ?? [])) {
      walkConfig("🪝", `hooks ${hook.name}`, hook, depth + 1);
    }

    // installers
    for (const inst of (m.installers ?? [])) {
      walkConfig("⚙️", `installer ${inst.name}`, inst, depth + 1);
    }

    // controllers
    for (const ctrl of (m.controllers ?? [])) {
      walkConfig("🧭", `controller ${ctrl.name}`, ctrl, depth + 1);
    }

    // submodules
    for (const s of m.subModules) {
      walkModule(s, depth + 1);
    }
  }

  walkModule(root, 0, true);
  return lines.join("\n");
}
