import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const TEMPLATE = readFileSync(
  join(__dirname, "templates", "piper.toml"),
  "utf-8",
);

export function init(): void {
  const configPath = join(".piper", "piper.toml");
  if (existsSync(configPath)) {
    throw new Error(
      `${configPath} already exists\nDelete it first if you want to regenerate.`,
    );
  }
  mkdirSync(".piper", { recursive: true });
  writeFileSync(configPath, TEMPLATE);
}
