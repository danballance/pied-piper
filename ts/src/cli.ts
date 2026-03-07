#!/usr/bin/env node

import { runCheck, runChecks, cleanEnv, getBiomeConfigArgs } from "./runner.js";
import { ALL_CHECKS_BY_NAME, FAST_CHECKS, FULL_CHECKS } from "./checks.js";
import { execSync } from "node:child_process";
import * as fs from "node:fs";

const VERSION = "0.1.0";

function format(): void {
  const env = cleanEnv();
  const configArgs = getBiomeConfigArgs();
  try {
    execSync(`biome format --write ${configArgs} .`.trim(), {
      stdio: "pipe",
      env,
    });
  } catch {}
  console.log("OK   format");
}

function fix(): void {
  const env = cleanEnv();
  const configArgs = getBiomeConfigArgs();
  try {
    execSync(`biome lint --write ${configArgs} .`.trim(), {
      stdio: "pipe",
      env,
    });
  } catch {}
  console.log("OK   fix");
}

function check(name: string): void {
  if (name === "fast") {
    const [exitCode, outputs] = runChecks(FAST_CHECKS);
    for (const output of outputs) {
      console.log(output);
    }
    process.exit(exitCode);
  }

  if (name === "full") {
    const [exitCode, outputs] = runChecks(FULL_CHECKS);
    for (const output of outputs) {
      console.log(output);
    }
    process.exit(exitCode);
  }

  const c = ALL_CHECKS_BY_NAME[name];
  if (c === undefined) {
    const available = Object.keys(ALL_CHECKS_BY_NAME).sort().join(", ");
    console.error(`error: unknown check '${name}'`);
    console.error(`available checks: fast, full, ${available}`);
    process.exit(1);
  }

  const [passed, output] = runCheck(c);
  console.log(output);
  process.exit(passed ? 0 : 2);
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
    console.error(
      "usage: piper-ts [--directory <path>] {check,fix,format,version} ...",
    );
    process.exit(2);
  }

  const command = args[0];

  if (command === "version") {
    console.log(`piper-ts ${VERSION}`);
    return;
  }

  if (command === "format") {
    format();
    return;
  }

  if (command === "fix") {
    fix();
    return;
  }

  if (command === "check") {
    if (args.length < 2) {
      const available = Object.keys(ALL_CHECKS_BY_NAME).sort().join(", ");
      console.error("error: missing check name");
      console.error(`available checks: fast, full, ${available}`);
      process.exit(1);
    }
    check(args[1]);
    return;
  }

  console.error(`error: unknown command '${command}'`);
  console.error("usage: piper-ts {check,fix,format,version} ...");
  process.exit(2);
}

main();
