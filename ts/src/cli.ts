#!/usr/bin/env node

import { runChecks } from "./runner.js";
import { FAST_CHECKS, FULL_CHECKS } from "./checks.js";
import { execSync } from "node:child_process";

const VERSION = "0.1.0";

const USAGE = `pied-piper - TypeScript code guardrails for agentic coding workflows

Usage: pied-piper <command>

Commands:
  check-fast    Format + lint + type check
  check-full    + architecture + dead code + type coverage + ast-grep
  fix           Auto-fix formatting and lint issues
  version       Print version
`;

function fix(): void {
  try {
    execSync("biome format --write .", { stdio: "pipe" });
  } catch {}
  try {
    execSync("biome lint --write .", { stdio: "pipe" });
  } catch {}
  console.log("OK   fix");
}

function main(): void {
  const command = process.argv[2];

  switch (command) {
    case "version":
      console.log(`pied-piper ${VERSION}`);
      break;

    case "--help":
    case "-h":
    case undefined:
      console.log(USAGE);
      break;

    case "fix":
      fix();
      break;

    case "check-fast":
    case "check-full": {
      const checks = command === "check-fast" ? FAST_CHECKS : FULL_CHECKS;
      const [exitCode, outputs] = runChecks(checks);
      for (const output of outputs) {
        console.log(output);
      }
      process.exit(exitCode);
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run 'pied-piper --help' for usage");
      process.exit(1);
  }
}

main();
