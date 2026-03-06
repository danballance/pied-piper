import { type Check, getBiomeConfigArgs } from "./runner.js";
import { hasFiles, hasConfigFile } from "./detect.js";

const noTsJsFiles = (): boolean => !hasFiles([".ts", ".tsx", ".js", ".jsx"]);
const noTsFiles = (): boolean => !hasFiles([".ts"]);
const noTsSrc = (): boolean => !hasFiles([".ts"], "src");
const noDepCruiserConfig = (): boolean =>
  !hasConfigFile(".dependency-cruiser.js") || !hasConfigFile("src");
const noSgConfig = (): boolean => !hasConfigFile("sgconfig.yml");

function biomeCmd(subcommand: string): () => string {
  return () => {
    const configArgs = getBiomeConfigArgs();
    return configArgs
      ? `biome ${subcommand} ${configArgs} .`
      : `biome ${subcommand} .`;
  };
}

export const FAST_CHECKS: Check[] = [
  {
    name: "ts:format",
    command: biomeCmd("format"),
    skipIf: noTsJsFiles,
  },
  {
    name: "ts:lint",
    command: biomeCmd("lint"),
    skipIf: noTsJsFiles,
  },
  {
    name: "ts:type",
    command: "tsc --noEmit",
    skipIf: noTsFiles,
  },
];

export const FULL_ONLY_CHECKS: Check[] = [
  {
    name: "ts:arch",
    command:
      'depcruise src/ --config .dependency-cruiser.js --exclude "(test|tests|__tests__|\\.(test|spec)\\.)"',
    skipIf: noDepCruiserConfig,
  },
  {
    name: "ts:deadcode",
    command: "knip --exclude files",
    skipIf: noTsSrc,
  },
  {
    name: "ts:typecov",
    command:
      'type-coverage --at-least 80 --ignore-files "**/*.test.ts" --ignore-files "**/*.spec.ts" --ignore-files "**/tests/**" --ignore-files "**/test/**" --ignore-files "**/__tests__/**"',
    skipIf: noTsSrc,
  },
  {
    name: "ts:astgrep",
    command: "ast-grep scan --config sgconfig.yml",
    skipIf: noSgConfig,
  },
];

export const FULL_CHECKS: Check[] = [...FAST_CHECKS, ...FULL_ONLY_CHECKS];

export const ALL_CHECKS_BY_NAME: Record<string, Check> = Object.fromEntries(
  FULL_CHECKS.map((c) => [
    c.name.startsWith("ts:") ? c.name.slice(3) : c.name,
    c,
  ]),
);
