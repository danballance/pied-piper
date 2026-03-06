import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runCheck,
  runChecks,
  getBiomeConfigArgs,
  cleanupTempBiomeConfig,
  type Check,
} from "../src/runner.js";
import * as child_process from "node:child_process";
import * as detect from "../src/detect.js";
import * as fs from "node:fs";
import * as os from "node:os";

vi.mock("node:child_process");
vi.mock("../src/detect.js", { spy: true });
vi.mock("node:fs", { spy: true });
vi.mock("node:os", { spy: true });

describe("runCheck", () => {
  it("returns OK on success", () => {
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from(""));
    const check: Check = {
      name: "test:pass",
      command: "echo hello",
      skipIf: () => false,
    };
    const [passed, output] = runCheck(check);
    expect(passed).toBe(true);
    expect(output).toBe("OK   test:pass");
  });

  it("returns FAIL on error", () => {
    const err = new Error("cmd failed") as any;
    err.stdout = Buffer.from("some error output\n");
    err.stderr = Buffer.from("");
    err.status = 1;
    vi.mocked(child_process.execSync).mockImplementation(() => {
      throw err;
    });
    const check: Check = {
      name: "test:fail",
      command: "ruff check .",
      skipIf: () => false,
    };
    const [passed, output] = runCheck(check);
    expect(passed).toBe(false);
    expect(output).toContain("FAIL test:fail");
    expect(output).toContain("COMMAND ruff check .");
    expect(output).toContain("some error output");
  });

  it("returns SKIP when skip condition is true", () => {
    const check: Check = {
      name: "test:skip",
      command: "echo",
      skipIf: () => true,
    };
    const [passed, output] = runCheck(check);
    expect(passed).toBe(true);
    expect(output).toContain("SKIP test:skip");
  });
});

describe("runChecks", () => {
  it("returns 0 when all pass", () => {
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from(""));
    const checks: Check[] = [
      { name: "a", command: "true", skipIf: () => false },
      { name: "b", command: "true", skipIf: () => false },
    ];
    const [exitCode, outputs] = runChecks(checks);
    expect(exitCode).toBe(0);
    expect(outputs).toHaveLength(2);
  });

  it("returns 2 when any fail", () => {
    let callCount = 0;
    vi.mocked(child_process.execSync).mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        const err = new Error() as any;
        err.stdout = Buffer.from("err");
        err.stderr = Buffer.from("");
        err.status = 1;
        throw err;
      }
      return Buffer.from("");
    });
    const checks: Check[] = [
      { name: "a", command: "true", skipIf: () => false },
      { name: "b", command: "false", skipIf: () => false },
    ];
    const [exitCode, outputs] = runChecks(checks);
    expect(exitCode).toBe(2);
    expect(outputs[0]).toContain("OK   a");
    expect(outputs[1]).toContain("FAIL b");
  });

  it("continues after failure", () => {
    let callCount = 0;
    vi.mocked(child_process.execSync).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const err = new Error() as any;
        err.stdout = Buffer.from("err");
        err.stderr = Buffer.from("");
        err.status = 1;
        throw err;
      }
      return Buffer.from("");
    });
    const checks: Check[] = [
      { name: "a", command: "false", skipIf: () => false },
      { name: "b", command: "true", skipIf: () => false },
    ];
    const [exitCode, outputs] = runChecks(checks);
    expect(exitCode).toBe(2);
    expect(outputs).toHaveLength(2);
    expect(outputs[1]).toContain("OK   b");
  });
});

describe("getBiomeConfigArgs", () => {
  const baseConfig = JSON.stringify({
    files: { ignoreUnknown: true, includes: ["**", "!**/.venv/**"] },
    formatter: { indentStyle: "space", indentWidth: 2 },
    linter: { rules: { recommended: true } },
  });
  const localConfig = JSON.stringify({
    $schema: "https://biomejs.dev/schemas/2.4.4/schema.json",
    extends: [],
    files: { includes: ["ui/**", "schema/**"] },
  });

  beforeEach(() => {
    cleanupTempBiomeConfig();
    vi.mocked(fs.mkdtempSync).mockReturnValue("/tmp/piper-ts-biome-test");
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.rmSync).mockImplementation(() => {});
    let readCount = 0;
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      readCount++;
      // First call reads base config, second reads local config
      return readCount === 1 ? baseConfig : localConfig;
    });
  });

  it("returns --config-path=<packageRoot> when no local biome config", () => {
    vi.mocked(detect.hasConfigFile).mockReturnValue(false);
    const args = getBiomeConfigArgs();
    expect(args).toMatch(/^--config-path=/);
    expect(args).not.toContain("tmp");
  });

  it("returns --config-path=<tempDir> when biome.json exists", () => {
    vi.mocked(detect.hasConfigFile).mockImplementation(
      (f) => f === "biome.json",
    );
    const args = getBiomeConfigArgs();
    expect(args).toBe("--config-path=/tmp/piper-ts-biome-test");
  });

  it("returns --config-path=<tempDir> when biome.jsonc exists", () => {
    vi.mocked(detect.hasConfigFile).mockImplementation(
      (f) => f === "biome.jsonc",
    );
    const args = getBiomeConfigArgs();
    expect(args).toBe("--config-path=/tmp/piper-ts-biome-test");
  });

  it("deep merges configs with local overriding base", () => {
    vi.mocked(detect.hasConfigFile).mockImplementation(
      (f) => f === "biome.json",
    );
    getBiomeConfigArgs();

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/tmp/piper-ts-biome-test/biome.json",
      expect.any(String),
    );
    const written = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
    );
    // No $schema or extends in merged output
    expect(written.$schema).toBeUndefined();
    expect(written.extends).toBeUndefined();
    // Local files.includes replaces base (array override, not merge)
    // Globs are resolved to absolute paths
    expect(written.files.includes).toHaveLength(2);
    expect(written.files.includes[0]).toMatch(/\/ui\/\*\*$/);
    expect(written.files.includes[1]).toMatch(/\/schema\/\*\*$/);
    // Base formatter settings are preserved (not in local config)
    expect(written.formatter.indentStyle).toBe("space");
    // Base files.ignoreUnknown is preserved (deep merge of objects)
    expect(written.files.ignoreUnknown).toBe(true);
  });

  it("caches temp dir across multiple calls", () => {
    vi.mocked(detect.hasConfigFile).mockImplementation(
      (f) => f === "biome.json",
    );
    getBiomeConfigArgs();
    const callsBefore = vi.mocked(fs.mkdtempSync).mock.calls.length;
    getBiomeConfigArgs();
    expect(vi.mocked(fs.mkdtempSync).mock.calls.length).toBe(callsBefore);
  });

  it("cleanupTempBiomeConfig removes temp dir", () => {
    vi.mocked(detect.hasConfigFile).mockImplementation(
      (f) => f === "biome.json",
    );
    getBiomeConfigArgs();
    cleanupTempBiomeConfig();
    expect(fs.rmSync).toHaveBeenCalledWith("/tmp/piper-ts-biome-test", {
      recursive: true,
    });
  });
});

describe("runCheck with function command", () => {
  it("resolves function-type command", () => {
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from(""));
    const check: Check = {
      name: "test:fn",
      command: () => "biome format --config-path=/tmp .",
      skipIf: () => false,
    };
    const [passed, output] = runCheck(check);
    expect(passed).toBe(true);
    expect(output).toBe("OK   test:fn");
  });

  it("shows resolved command in FAIL output", () => {
    const err = new Error() as any;
    err.stdout = Buffer.from("err");
    err.stderr = Buffer.from("");
    err.status = 1;
    vi.mocked(child_process.execSync).mockImplementation(() => {
      throw err;
    });
    const check: Check = {
      name: "test:fn-fail",
      command: () => "biome lint --config-path=/tmp .",
      skipIf: () => false,
    };
    const [passed, output] = runCheck(check);
    expect(passed).toBe(false);
    expect(output).toContain("COMMAND biome lint --config-path=/tmp .");
  });
});
