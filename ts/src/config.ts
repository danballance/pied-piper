import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "smol-toml";

const CONFIG_PATH = join(".piper", "piper.toml");

export function loadConfig(configPath: string = CONFIG_PATH): Record<string, any> {
  let content: string;
  try {
    content = readFileSync(configPath, "utf-8");
  } catch {
    throw new Error(
      `${configPath} not found\nRun 'piper-ts init' to generate the default configuration.`,
    );
  }
  return parse(content);
}

export function resolveCommands(
  config: Record<string, any>,
  section: string,
  name?: string,
): [string, string][] {
  const sectionData = config[section];
  if (!sectionData) {
    throw new Error(`section '${section}' not found in config`);
  }

  if (name === undefined) {
    return Object.entries(sectionData).filter(
      ([, v]) => typeof v === "string",
    ) as [string, string][];
  }

  const tiers = (sectionData.tiers ?? {}) as Record<string, string[]>;
  if (name in tiers) {
    const groups = tiers[name];
    const commands: [string, string][] = [];
    for (const groupName of groups) {
      const group = sectionData[groupName];
      if (group && typeof group === "object") {
        for (const [k, v] of Object.entries(group)) {
          if (typeof v === "string") {
            commands.push([k, v]);
          }
        }
      }
    }
    return commands;
  }

  for (const [key, value] of Object.entries(sectionData)) {
    if (key === "tiers") continue;
    if (value && typeof value === "object" && name in (value as Record<string, unknown>)) {
      return [[name, (value as Record<string, string>)[name]]];
    }
  }

  const available = availableNames(sectionData);
  throw new Error(`unknown name '${name}'\navailable: ${available.join(", ")}`);
}

function availableNames(sectionData: Record<string, any>): string[] {
  const tierNames = Object.keys(sectionData.tiers ?? {});
  const individuals: string[] = [];
  for (const [key, value] of Object.entries(sectionData)) {
    if (key !== "tiers" && value && typeof value === "object") {
      individuals.push(...Object.keys(value as Record<string, unknown>));
    }
  }
  return [...tierNames, ...individuals.sort()];
}
