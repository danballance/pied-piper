import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "piper-ts-test-"));
}

const cli = path.resolve("src/cli.ts");

function runCli(command: string, cwd: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`npx tsx ${cli} ${command}`, {
      stdio: "pipe",
      encoding: "utf-8",
      cwd,
    });
    return { stdout, exitCode: 0 };
  } catch (err: any) {
    return { stdout: (err.stdout ?? "") + (err.stderr ?? ""), exitCode: err.status ?? 1 };
  }
}

describe("integration", () => {
  it("skips all checks when no TS/JS files", () => {
    const tmp = makeTmpDir();
    const { stdout, exitCode } = runCli("check-fast", tmp);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("SKIP");
    fs.rmSync(tmp, { recursive: true });
  });
});
