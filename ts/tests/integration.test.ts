import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "piper-ts-test-"));
}

const cli = path.resolve("src/cli.ts");

function runCli(
  command: string,
  cwd: string,
): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`npx tsx ${cli} ${command}`, {
      stdio: "pipe",
      encoding: "utf-8",
      cwd,
    });
    return { stdout, exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: (err.stdout ?? "") + (err.stderr ?? ""),
      exitCode: err.status ?? 1,
    };
  }
}

describe("integration", { timeout: 15_000 }, () => {
  it("skips all checks when no TS/JS files", () => {
    const tmp = makeTmpDir();
    const { stdout, exitCode } = runCli("check fast", tmp);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("SKIP");
    fs.rmSync(tmp, { recursive: true });
  });

  it("applies piper-ts defaults when local biome.json exists", () => {
    const tmp = makeTmpDir();
    // File formatted with 2-space indent (piper-ts default)
    fs.writeFileSync(path.join(tmp, "index.ts"), "const x = {\n  a: 1,\n};\n");
    // Local biome.json with no formatter settings (would use tabs by default)
    fs.writeFileSync(
      path.join(tmp, "biome.json"),
      '{\n  "files": {\n    "includes": ["**"]\n  }\n}\n',
    );
    const { stdout, exitCode } = runCli("check format", tmp);
    // Should pass because piper-ts defaults (2-space indent) are merged in
    expect(stdout).toContain("OK   ts:format");
    expect(exitCode).toBe(0);
    fs.rmSync(tmp, { recursive: true });
  });
});
