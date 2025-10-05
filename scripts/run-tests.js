import { glob } from "glob";
import { spawn } from "node:child_process";

const files = await glob("src/**/*.test.ts");
/* c8 ignore start */
if (files.length === 0) {
  // eslint-disable-next-line no-undef
  process.exit(1);
}
/* c8 ignore stop */

const proc = spawn("node", ["--import", "tsx", "--test", ...files], {
  stdio: "inherit",
});

proc.on("exit", (code) => {
  // eslint-disable-next-line no-undef
  process.exit(code);
});
