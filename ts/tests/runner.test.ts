import { describe, it, expect } from "vitest";
import { runCommand, runCommands } from "../src/runner.js";

describe("runner", () => {
  it("reports OK on success", () => {
    const [passed, output] = runCommand("format", "echo ok");
    expect(passed).toBe(true);
    expect(output).toBe("OK   format");
  });

  it("reports FAIL with output on failure", () => {
    const [passed, output] = runCommand("lint", "echo 'error found' && exit 1");
    expect(passed).toBe(false);
    expect(output).toContain("FAIL lint");
    expect(output).toContain("COMMAND");
  });

  it("runs all commands and returns exit 0 when all pass", () => {
    const [exitCode, outputs] = runCommands([
      ["a", "echo ok"],
      ["b", "echo ok"],
    ]);
    expect(exitCode).toBe(0);
    expect(outputs).toHaveLength(2);
  });

  it("returns exit 2 when any command fails", () => {
    const [exitCode, outputs] = runCommands([
      ["a", "echo ok"],
      ["b", "exit 1"],
    ]);
    expect(exitCode).toBe(2);
    expect(outputs[0]).toContain("OK   a");
    expect(outputs[1]).toContain("FAIL b");
  });

  it("continues after failure", () => {
    const [exitCode, outputs] = runCommands([
      ["a", "exit 1"],
      ["b", "echo ok"],
    ]);
    expect(exitCode).toBe(2);
    expect(outputs).toHaveLength(2);
    expect(outputs[1]).toContain("OK   b");
  });
});
