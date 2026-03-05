import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hasConfigFile } from "./detect.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(__dirname);
const nodeModulesBin = join(packageRoot, "node_modules", ".bin");

export function cleanEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  env.PATH = nodeModulesBin + ":" + (env.PATH ?? "");
  return env;
}

export function getBiomeConfigArgs(): string {
  if (hasConfigFile("biome.json") || hasConfigFile("biome.jsonc")) {
    return "";
  }
  return `--config-path=${packageRoot}`;
}

export interface Check {
  name: string;
  command: string | (() => string);
  skipIf: () => boolean;
}

export function runCheck(check: Check): [boolean, string] {
  if (check.skipIf()) {
    return [true, `SKIP ${check.name} (not applicable)`];
  }

  const command = typeof check.command === "function" ? check.command() : check.command;

  try {
    execSync(command, { stdio: "pipe", env: cleanEnv() });
    return [true, `OK   ${check.name}`];
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer; stderr?: Buffer };
    const stdout = e.stdout?.toString() ?? "";
    const stderr = e.stderr?.toString() ?? "";
    const output = (stdout + stderr).trimEnd();
    return [false, `FAIL ${check.name}\nCOMMAND ${command}\n${output}`];
  }
}

export function runChecks(checks: Check[]): [number, string[]] {
  let anyFailed = false;
  const outputs: string[] = [];

  for (const check of checks) {
    const [passed, output] = runCheck(check);
    outputs.push(output);
    if (!passed) {
      anyFailed = true;
    }
  }

  return [anyFailed ? 2 : 0, outputs];
}
