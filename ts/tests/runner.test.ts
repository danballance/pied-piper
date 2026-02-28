import { describe, it, expect, vi } from "vitest";
import { runCheck, runChecks, type Check } from "../src/runner.js";
import * as child_process from "node:child_process";

vi.mock("node:child_process");

describe("runCheck", () => {
  it("returns OK on success", () => {
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from(""));
    const check: Check = {
      name: "test:pass",
      command: "echo hello",
      skipIf: () => false,
    };
    const [passed, output] = runCheck(check);
    expect(passed).toBe(true);
    expect(output).toBe("OK   test:pass");
  });

  it("returns FAIL on error", () => {
    const err = new Error("cmd failed") as any;
    err.stdout = Buffer.from("some error output\n");
    err.stderr = Buffer.from("");
    err.status = 1;
    vi.mocked(child_process.execSync).mockImplementation(() => {
      throw err;
    });
    const check: Check = {
      name: "test:fail",
      command: "ruff check .",
      skipIf: () => false,
    };
    const [passed, output] = runCheck(check);
    expect(passed).toBe(false);
    expect(output).toContain("FAIL test:fail");
    expect(output).toContain("COMMAND ruff check .");
    expect(output).toContain("some error output");
  });

  it("returns SKIP when skip condition is true", () => {
    const check: Check = {
      name: "test:skip",
      command: "echo",
      skipIf: () => true,
    };
    const [passed, output] = runCheck(check);
    expect(passed).toBe(true);
    expect(output).toContain("SKIP test:skip");
  });
});

describe("runChecks", () => {
  it("returns 0 when all pass", () => {
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from(""));
    const checks: Check[] = [
      { name: "a", command: "true", skipIf: () => false },
      { name: "b", command: "true", skipIf: () => false },
    ];
    const [exitCode, outputs] = runChecks(checks);
    expect(exitCode).toBe(0);
    expect(outputs).toHaveLength(2);
  });

  it("returns 2 when any fail", () => {
    let callCount = 0;
    vi.mocked(child_process.execSync).mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        const err = new Error() as any;
        err.stdout = Buffer.from("err");
        err.stderr = Buffer.from("");
        err.status = 1;
        throw err;
      }
      return Buffer.from("");
    });
    const checks: Check[] = [
      { name: "a", command: "true", skipIf: () => false },
      { name: "b", command: "false", skipIf: () => false },
    ];
    const [exitCode, outputs] = runChecks(checks);
    expect(exitCode).toBe(2);
    expect(outputs[0]).toContain("OK   a");
    expect(outputs[1]).toContain("FAIL b");
  });

  it("continues after failure", () => {
    let callCount = 0;
    vi.mocked(child_process.execSync).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const err = new Error() as any;
        err.stdout = Buffer.from("err");
        err.stderr = Buffer.from("");
        err.status = 1;
        throw err;
      }
      return Buffer.from("");
    });
    const checks: Check[] = [
      { name: "a", command: "false", skipIf: () => false },
      { name: "b", command: "true", skipIf: () => false },
    ];
    const [exitCode, outputs] = runChecks(checks);
    expect(exitCode).toBe(2);
    expect(outputs).toHaveLength(2);
    expect(outputs[1]).toContain("OK   b");
  });
});
