// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => unknown;

export function ensureAsyncCallback(name: string, fn: AnyFn): void {
  if (fn.constructor.name !== "AsyncFunction") {
    throw new TypeError(
      `Expected an async function for "${name}". ` +
        `Stratify enforces the use of async functions for hooks and route handlers ` +
        `to avoid mixing promise and callback paradigms, which can cause unexpected behavior.`,
    );
  }
}

export function ensureAsyncCallbacks(
  name: string,
  fns?: AnyFn | AnyFn[],
): void {
  if (!fns) return;

  const list = Array.isArray(fns) ? fns : [fns];
  for (let i = 0; i < list.length; i++) {
    ensureAsyncCallback(`${name}[${i}]`, list[i]);
  }
}
