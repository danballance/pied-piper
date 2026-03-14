import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

const cli = path.resolve("src/cli.ts");

const SAMPLE_CONFIG = `
[check]
tiers = { fast = ["fast"], full = ["fast", "full"] }

[check.fast]
format = "echo check-format"
lint = "echo check-lint"

[check.full]
arch = "echo check-arch"

[test]
tiers = { unit = ["unit"], full = ["unit", "full"], e2e = ["e2e"] }

[test.unit]
unit = "echo test-unit"

[test.full]
contract = "echo test-contract"

[test.e2e]
e2e = "echo test-e2e"

[format]
ts = "echo format-ts"

[fix]
lint = "echo fix-lint"
`;

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "piper-test-"));
}

function makeTmpDirWithConfig(): string {
  const tmp = makeTmpDir();
  const piperDir = path.join(tmp, ".piper");
  fs.mkdirSync(piperDir);
  fs.writeFileSync(path.join(piperDir, "piper.toml"), SAMPLE_CONFIG);
  return tmp;
}

function run(
  args: string,
  cwd?: string,
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`npx tsx ${cli} ${args}`, {
      stdio: "pipe",
      encoding: "utf-8",
      cwd,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.status ?? 1,
    };
  }
}

describe("CLI", { timeout: 15_000 }, () => {
  it("prints version", () => {
    const { stdout, exitCode } = run("version");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("piper-ts");
  });

  describe("with config", () => {
    let tmp: string;

    beforeEach(() => {
      tmp = makeTmpDirWithConfig();
    });

    afterEach(() => {
      fs.rmSync(tmp, { recursive: true });
    });

    it("check fast runs tier commands", () => {
      const { stdout, exitCode } = run("check fast", tmp);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("OK   format");
      expect(stdout).toContain("OK   lint");
    });

    it("check full runs additive tiers", () => {
      const { stdout, exitCode } = run("check full", tmp);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("OK   arch");
    });

    it("check individual by name", () => {
      const { stdout, exitCode } = run("check format", tmp);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("OK   format");
    });

    it("check invalid name exits 1", () => {
      const { stderr, exitCode } = run("check bogus", tmp);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("bogus");
    });

    it("test unit runs tier", () => {
      const { stdout, exitCode } = run("test unit", tmp);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("OK   unit");
    });

    it("test full is additive", () => {
      const { stdout, exitCode } = run("test full", tmp);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("OK   unit");
      expect(stdout).toContain("OK   contract");
    });

    it("test e2e is standalone", () => {
      const { stdout, exitCode } = run("test e2e", tmp);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("OK   e2e");
      expect(stdout).not.toContain("unit");
    });

    it("test individual by name", () => {
      const { stdout, exitCode } = run("test contract", tmp);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("OK   contract");
    });

    it("format runs all format commands", () => {
      const { stdout, exitCode } = run("format", tmp);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("OK   ts");
    });

    it("fix runs all fix commands", () => {
      const { stdout, exitCode } = run("fix", tmp);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("OK   lint");
    });
  });

  it("init creates .piper/piper.toml", () => {
    const tmp = makeTmpDir();
    try {
      const { stdout, exitCode } = run("init", tmp);
      expect(exitCode).toBe(0);
      expect(fs.existsSync(path.join(tmp, ".piper", "piper.toml"))).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it("check with no name exits 1", () => {
    const { exitCode } = run("check");
    expect(exitCode).toBe(1);
  });

  it("test with no name exits 1", () => {
    const { exitCode } = run("test");
    expect(exitCode).toBe(1);
  });

  it("rejects unknown commands", () => {
    const { exitCode } = run("nonsense");
    expect(exitCode).toBe(2);
  });

  it("no args exits with error", () => {
    const { exitCode } = run("");
    expect(exitCode).toBe(2);
  });

  it("no config shows init message", () => {
    const tmp = makeTmpDir();
    try {
      const { stderr, exitCode } = run("check fast", tmp);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("init");
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it("--directory flag works", () => {
    const tmp = makeTmpDirWithConfig();
    try {
      const { stdout, exitCode } = run(`--directory ${tmp} format`);
      expect(exitCode).toBe(0);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it("-d is alias for --directory", () => {
    const tmp = makeTmpDirWithConfig();
    try {
      const { exitCode } = run(`-d ${tmp} version`);
      expect(exitCode).toBe(0);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it("--directory with nonexistent path exits 1", () => {
    const { exitCode, stderr } = run("--directory /nonexistent/xyz version");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("does not exist");
  });

  it("--directory without value exits 1", () => {
    const { exitCode } = run("--directory");
    expect(exitCode).toBe(1);
  });
});
