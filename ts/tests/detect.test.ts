import { describe, it, expect } from "vitest";
import { hasFiles, hasConfigFile } from "../src/detect.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "piper-test-"));
}

describe("hasFiles", () => {
  it("finds .ts files", () => {
    const tmp = makeTmpDir();
    fs.writeFileSync(path.join(tmp, "foo.ts"), "");
    expect(hasFiles([".ts"], tmp)).toBe(true);
    fs.rmSync(tmp, { recursive: true });
  });

  it("returns false for empty dir", () => {
    const tmp = makeTmpDir();
    expect(hasFiles([".ts"], tmp)).toBe(false);
    fs.rmSync(tmp, { recursive: true });
  });

  it("excludes node_modules", () => {
    const tmp = makeTmpDir();
    const nm = path.join(tmp, "node_modules");
    fs.mkdirSync(nm);
    fs.writeFileSync(path.join(nm, "dep.ts"), "");
    expect(hasFiles([".ts"], tmp)).toBe(false);
    fs.rmSync(tmp, { recursive: true });
  });

  it("finds nested files", () => {
    const tmp = makeTmpDir();
    const nested = path.join(tmp, "src", "components");
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, "App.tsx"), "");
    expect(hasFiles([".tsx"], tmp)).toBe(true);
    fs.rmSync(tmp, { recursive: true });
  });
});

describe("hasConfigFile", () => {
  it("returns true when file exists", () => {
    const tmp = makeTmpDir();
    fs.writeFileSync(path.join(tmp, "biome.json"), "{}");
    expect(hasConfigFile("biome.json", tmp)).toBe(true);
    fs.rmSync(tmp, { recursive: true });
  });

  it("returns false when file missing", () => {
    const tmp = makeTmpDir();
    expect(hasConfigFile("biome.json", tmp)).toBe(false);
    fs.rmSync(tmp, { recursive: true });
  });
});
