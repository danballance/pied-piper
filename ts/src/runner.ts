import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(__dirname);
const nodeModulesBin = join(packageRoot, "node_modules", ".bin");

export function cleanEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  env.PATH = nodeModulesBin + ":" + (env.PATH ?? "");
  return env;
}

export function runCommand(name: string, command: string): [boolean, string] {
  try {
    execSync(command, { stdio: "pipe", env: cleanEnv() });
    return [true, `OK   ${name}`];
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer; stderr?: Buffer };
    const stdout = e.stdout?.toString() ?? "";
    const stderr = e.stderr?.toString() ?? "";
    const output = (stdout + stderr).trimEnd();
    return [false, `FAIL ${name}\nCOMMAND ${command}\n${output}`];
  }
}

export function runCommands(
  commands: [string, string][],
): [number, string[]] {
  let anyFailed = false;
  const outputs: string[] = [];

  for (const [name, command] of commands) {
    const [passed, output] = runCommand(name, command);
    outputs.push(output);
    if (!passed) {
      anyFailed = true;
    }
  }

  return [anyFailed ? 2 : 0, outputs];
}
