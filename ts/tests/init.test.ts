import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { init, TEMPLATE } from "../src/init.js";
import { parse } from "smol-toml";

describe("init", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "piper-init-"));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("creates .piper directory", () => {
    init();
    expect(fs.existsSync(path.join(tmpDir, ".piper"))).toBe(true);
  });

  it("creates piper.toml", () => {
    init();
    expect(fs.existsSync(path.join(tmpDir, ".piper", "piper.toml"))).toBe(true);
  });

  it("generates valid TOML", () => {
    init();
    const content = fs.readFileSync(
      path.join(tmpDir, ".piper", "piper.toml"),
      "utf-8",
    );
    const config = parse(content);
    expect(config.check).toBeDefined();
    expect(config.test).toBeDefined();
    expect(config.format).toBeDefined();
    expect(config.fix).toBeDefined();
  });

  it("errors if piper.toml already exists", () => {
    init();
    expect(() => init()).toThrow("already exists");
  });

  it("template is valid TOML", () => {
    const config = parse(TEMPLATE);
    expect(config.check).toBeDefined();
  });
});
