#!/usr/bin/env node

import { runCheck, runChecks } from "./runner.js";
import { ALL_CHECKS_BY_NAME, FAST_CHECKS, FULL_CHECKS } from "./checks.js";
import { execSync } from "node:child_process";

const VERSION = "0.1.0";

function fix(): void {
  try {
    execSync("biome format --write .", { stdio: "pipe" });
  } catch {}
  try {
    execSync("biome lint --write .", { stdio: "pipe" });
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

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("usage: piper-ts {check,fix,version} ...");
    process.exit(2);
  }

  const command = args[0];

  if (command === "version") {
    console.log(`piper-ts ${VERSION}`);
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
  console.error("usage: piper-ts {check,fix,version} ...");
  process.exit(2);
}

main();
