import { execSync } from "node:child_process";

export interface Check {
  name: string;
  command: string;
  skipIf: () => boolean;
}

export function runCheck(check: Check): [boolean, string] {
  if (check.skipIf()) {
    return [true, `SKIP ${check.name} (not applicable)`];
  }

  try {
    execSync(check.command, { stdio: "pipe" });
    return [true, `OK   ${check.name}`];
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer; stderr?: Buffer };
    const stdout = e.stdout?.toString() ?? "";
    const stderr = e.stderr?.toString() ?? "";
    const output = (stdout + stderr).trimEnd();
    return [false, `FAIL ${check.name}\nCOMMAND ${check.command}\n${output}`];
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
