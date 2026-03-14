import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadConfig, resolveCommands } from "../src/config.js";

const SAMPLE_TOML = `
[check]
tiers = { fast = ["fast"], full = ["fast", "full"] }

[check.fast]
format = "biome format ."
lint = "biome check ."

[check.full]
arch = "depcruise src/"

[test]
tiers = { unit = ["unit"], full = ["unit", "full"], e2e = ["e2e"] }

[test.unit]
unit = "vitest run"

[test.full]
contract = "vitest run --filter contract"

[test.e2e]
e2e = "playwright test"

[format]
ts = "biome format --write ."

[fix]
lint = "biome check --fix ."
`;

describe("config", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "piper-test-"));
    const piperDir = path.join(tmpDir, ".piper");
    fs.mkdirSync(piperDir);
    fs.writeFileSync(path.join(piperDir, "piper.toml"), SAMPLE_TOML);
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("loads config from .piper/piper.toml", () => {
    const config = loadConfig();
    expect(config.check).toBeDefined();
    expect(config.test).toBeDefined();
    expect(config.format).toBeDefined();
    expect(config.fix).toBeDefined();
  });

  it("throws when config file missing", () => {
    process.chdir(originalCwd);
    const noConfig = fs.mkdtempSync(path.join(os.tmpdir(), "piper-empty-"));
    process.chdir(noConfig);
    expect(() => loadConfig()).toThrow("piper.toml");
    process.chdir(originalCwd);
    fs.rmSync(noConfig, { recursive: true });
  });

  it("resolves check tier fast", () => {
    const config = loadConfig();
    const commands = resolveCommands(config, "check", "fast");
    const names = commands.map(([n]) => n);
    expect(names).toEqual(["format", "lint"]);
  });

  it("resolves check tier full (additive)", () => {
    const config = loadConfig();
    const commands = resolveCommands(config, "check", "full");
    const names = commands.map(([n]) => n);
    expect(names).toEqual(["format", "lint", "arch"]);
  });

  it("resolves individual check by name", () => {
    const config = loadConfig();
    const commands = resolveCommands(config, "check", "format");
    expect(commands).toEqual([["format", "biome format ."]]);
  });

  it("throws on unknown check name", () => {
    const config = loadConfig();
    expect(() => resolveCommands(config, "check", "bogus")).toThrow("bogus");
  });

  it("resolves format section (no name)", () => {
    const config = loadConfig();
    const commands = resolveCommands(config, "format");
    expect(commands).toEqual([["ts", "biome format --write ."]]);
  });

  it("resolves test tier e2e standalone", () => {
    const config = loadConfig();
    const commands = resolveCommands(config, "test", "e2e");
    expect(commands).toEqual([["e2e", "playwright test"]]);
  });

  it("resolves test tier full (additive)", () => {
    const config = loadConfig();
    const commands = resolveCommands(config, "test", "full");
    const names = commands.map(([n]) => n);
    expect(names).toEqual(["unit", "contract"]);
  });

  it("resolves test individual by name", () => {
    const config = loadConfig();
    const commands = resolveCommands(config, "test", "contract");
    expect(commands).toEqual([["contract", "vitest run --filter contract"]]);
  });
});
