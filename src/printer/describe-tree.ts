import { getModuleId, type ModuleAny } from "../modules/module";
import { getProviderId, type ProviderAny } from "../providers/providers";

const useColor = () => process.stdout.isTTY;
const wrap = (code: number, s: string, enabled: boolean) => {
  /* c8 ignore next - Only used by CLI */
  return enabled ? `\x1b[${code}m${s}\x1b[0m` : s;
};

const c = (enabled: boolean) => ({
  dim: (s: string) => wrap(2, s, enabled),
  cyan: (s: string) => wrap(36, s, enabled),
  green: (s: string) => wrap(32, s, enabled),
  yellow: (s: string) => wrap(33, s, enabled),
});

export function describeTree(root: ModuleAny): string {
  const lines: string[] = [];
  const col = c(useColor());

  function walkProvider(p: ProviderAny, depth: number) {
    const pad = "  ".repeat(depth);
    const life = p.lifecycle;
    const lifeCol = life === "transient" ? col.yellow(life) : col.green(life);

    lines.push(
      `${pad}🔧 ${col.dim("prov")} ` +
        `${col.cyan(`${p.name}@${getProviderId(p)}`)} ` +
        `[${lifeCol}]`,
    );

    for (const dep of Object.values(p.deps) as ProviderAny[]) {
      walkProvider(dep, depth + 1);
    }
  }

  function walk(m: ModuleAny, depth: number, isRoot = false) {
    const pad = "  ".repeat(depth);
    const emoji = isRoot ? "🌳" : "📦";

    lines.push(
      `${pad}${emoji} ${col.dim("mod")} ` +
        `${col.cyan(`${m.name}@${getModuleId(m)}`)} ` +
        `${col.dim(`(encapsulate=${m.encapsulate !== false})`)}`,
    );

    for (const p of Object.values(m.deps) as ProviderAny[]) {
      walkProvider(p, depth + 1);
    }
    
    for (const s of m.subModules) {
      walk(s, depth + 1);
    }
  }

  walk(root, 0, true);

  return lines.join("\n");
}
