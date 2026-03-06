import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { hasConfigFile } from "./detect.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(__dirname);
const nodeModulesBin = join(packageRoot, "node_modules", ".bin");

export function cleanEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  env.PATH = nodeModulesBin + ":" + (env.PATH ?? "");
  return env;
}

let _tempDir: string | null = null;

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const baseVal = base[key];
    const overVal = override[key];
    if (
      baseVal &&
      overVal &&
      typeof baseVal === "object" &&
      typeof overVal === "object" &&
      !Array.isArray(baseVal) &&
      !Array.isArray(overVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overVal as Record<string, unknown>,
      );
    } else {
      result[key] = overVal;
    }
  }
  return result;
}

function readJsonConfig(path: string): Record<string, unknown> {
  const text = readFileSync(path, "utf-8");
  return JSON.parse(text) as Record<string, unknown>;
}

function resolveGlobs(config: Record<string, unknown>, rootDir: string): void {
  const files = config.files as Record<string, unknown> | undefined;
  if (!files) return;
  const includes = files.includes as string[] | undefined;
  if (!includes) return;
  files.includes = includes.map((pattern) => {
    if (isAbsolute(pattern)) return pattern;
    // Negation patterns: preserve the ! prefix, resolve the rest
    if (pattern.startsWith("!")) {
      const inner = pattern.slice(1);
      if (isAbsolute(inner)) return pattern;
      return "!" + join(rootDir, inner);
    }
    return join(rootDir, pattern);
  });
}

function ensureTempBiomeConfig(): string {
  if (_tempDir) return _tempDir;

  const localConfigName = hasConfigFile("biome.json")
    ? "biome.json"
    : "biome.jsonc";
  const localConfigPath = join(process.cwd(), localConfigName);

  const baseConfig = readJsonConfig(join(packageRoot, "biome.json"));
  const localConfig = readJsonConfig(localConfigPath);

  // Remove fields that shouldn't be merged
  delete baseConfig.$schema;
  delete localConfig.$schema;
  delete baseConfig.extends;
  delete localConfig.extends;

  // Make glob patterns absolute so they resolve correctly regardless
  // of where the temp config is written (biome resolves files.includes
  // relative to the config file location).
  resolveGlobs(baseConfig, packageRoot);
  resolveGlobs(localConfig, process.cwd());

  // Deep merge: local config overrides base for objects, replaces for arrays
  const mergedConfig = deepMerge(baseConfig, localConfig);

  _tempDir = mkdtempSync(join(tmpdir(), "piper-ts-biome-"));
  writeFileSync(
    join(_tempDir, "biome.json"),
    JSON.stringify(mergedConfig, null, 2),
  );

  process.on("exit", cleanupTempBiomeConfig);

  return _tempDir;
}

export function cleanupTempBiomeConfig(): void {
  if (_tempDir) {
    try {
      rmSync(_tempDir, { recursive: true });
    } catch {}
    _tempDir = null;
  }
}

export function getBiomeConfigArgs(): string {
  if (!hasConfigFile("biome.json") && !hasConfigFile("biome.jsonc")) {
    return `--config-path=${packageRoot}`;
  }
  const tempDir = ensureTempBiomeConfig();
  return `--config-path=${tempDir}`;
}

export interface Check {
  name: string;
  command: string | (() => string);
  skipIf: () => boolean;
}

export function runCheck(check: Check): [boolean, string] {
  if (check.skipIf()) {
    return [true, `SKIP ${check.name} (not applicable)`];
  }

  const command =
    typeof check.command === "function" ? check.command() : check.command;

  try {
    execSync(command, { stdio: "pipe", env: cleanEnv() });
    return [true, `OK   ${check.name}`];
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer; stderr?: Buffer };
    const stdout = e.stdout?.toString() ?? "";
    const stderr = e.stderr?.toString() ?? "";
    const output = (stdout + stderr).trimEnd();
    return [false, `FAIL ${check.name}\nCOMMAND ${command}\n${output}`];
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
