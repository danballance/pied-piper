#!/usr/bin/env node

import * as fs from "node:fs";
import { loadConfig, resolveCommands } from "./config.js";
import { init } from "./init.js";
import { runCommands } from "./runner.js";

const VERSION = "0.1.0";
const USAGE =
  "usage: piper-ts [--directory <path>] {init,check,test,format,fix,version} ...";

function runSection(section: string, name?: string): void {
  let config: Record<string, any>;
  try {
    config = loadConfig();
  } catch (e: unknown) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }

  let commands: [string, string][];
  try {
    commands = resolveCommands(config, section, name);
  } catch (e: unknown) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }

  if (commands.length === 0) {
    console.error(`error: no commands configured for '${section}'`);
    process.exit(1);
  }

  const [exitCode, outputs] = runCommands(commands);
  const stream = exitCode ? process.stderr : process.stdout;
  for (const line of outputs) {
    stream.write(line + "\n");
  }
  process.exit(exitCode);
}

function extractDirectoryFlag(args: string[]): string[] {
  const idx = args.findIndex((a) => a === "--directory" || a === "-d");
  if (idx === -1) return args;

  if (idx + 1 >= args.length) {
    console.error("error: --directory requires a path argument");
    process.exit(1);
  }

  const target = args[idx + 1];
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    console.error(`error: directory does not exist: ${target}`);
    process.exit(1);
  }

  process.chdir(target);
  return [...args.slice(0, idx), ...args.slice(idx + 2)];
}

function main(): void {
  const args = extractDirectoryFlag(process.argv.slice(2));

  if (args.length === 0) {
    console.error(USAGE);
    process.exit(2);
  }

  const command = args[0];

  if (command === "version") {
    console.log(`piper-ts ${VERSION}`);
    return;
  }

  if (command === "init") {
    try {
      init();
      console.log("Created .piper/piper.toml");
    } catch (e: unknown) {
      console.error(`error: ${(e as Error).message}`);
      process.exit(1);
    }
    return;
  }

  if (command === "check" || command === "test") {
    if (args.length < 2) {
      console.error(`error: missing ${command} name`);
      process.exit(1);
    }
    runSection(command, args[1]);
    return;
  }

  if (command === "format" || command === "fix") {
    runSection(command);
    return;
  }

  console.error(`error: unknown command '${command}'`);
  console.error(USAGE);
  process.exit(2);
}

main();
