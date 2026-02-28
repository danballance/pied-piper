import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import * as path from "node:path";

const cli = path.resolve("src/cli.ts");

function run(args: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`npx tsx ${cli} ${args}`, {
      stdio: "pipe",
      encoding: "utf-8",
    });
    return { stdout, exitCode: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? "", exitCode: err.status ?? 1 };
  }
}

describe("CLI", () => {
  it("prints version", () => {
    const { stdout, exitCode } = run("version");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("pied-piper");
  });

  it("shows help", () => {
    const { stdout, exitCode } = run("--help");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("check-fast");
    expect(stdout).toContain("check-full");
  });

  it("rejects unknown commands", () => {
    const { exitCode } = run("nonsense");
    expect(exitCode).not.toBe(0);
  });
});
