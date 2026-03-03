import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import * as path from "node:path";

const cli = path.resolve("src/cli.ts");

function run(args: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`npx tsx ${cli} ${args}`, {
      stdio: "pipe",
      encoding: "utf-8",
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", exitCode: err.status ?? 1 };
  }
}

describe("CLI", { timeout: 15_000 }, () => {
  it("prints version", () => {
    const { stdout, exitCode } = run("version");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("piper-ts");
  });

  it("check fast parses correctly", () => {
    const { exitCode } = run("check fast");
    expect([0, 2]).toContain(exitCode);
  });

  it("check full parses correctly", () => {
    const { exitCode } = run("check full");
    expect([0, 2]).toContain(exitCode);
  });

  it("check individual parses correctly", () => {
    const { exitCode } = run("check format");
    expect([0, 2]).toContain(exitCode);
  });

  it("check invalid name exits 1 with error", () => {
    const { stderr, exitCode } = run("check bogus");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("bogus");
    expect(stderr).toContain("format");
  });

  it("check with no name exits 1", () => {
    const { stderr, exitCode } = run("check");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("format");
  });

  it("rejects unknown commands", () => {
    const { exitCode } = run("nonsense");
    expect(exitCode).toBe(2);
  });

  it("no args exits with error", () => {
    const { exitCode } = run("");
    expect(exitCode).toBe(2);
  });
});
