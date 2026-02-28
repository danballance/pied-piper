# Pivot to uvx/npx Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Docker + Just architecture with two self-contained CLI tools distributed via uvx (Python) and npx (TypeScript).

**Architecture:** Monorepo with `py/` and `ts/` subdirectories. Each is an independently publishable package that wraps its language's code quality tools, runs them via subprocess, and normalizes output to OK/FAIL format with exit code 2 on failure (Claude Code hook convention).

**Tech Stack:** Python 3.12 (argparse, subprocess, os, pathlib), TypeScript (Node.js built-ins: child_process, fs, path), pytest, vitest.

**Design doc:** `docs/plans/2026-02-28-pivot-to-uvx-npx-design.md`

---

## Task 1: Python package skeleton

**Files:**
- Create: `py/pyproject.toml`
- Create: `py/src/piper_py/__init__.py`

**Step 1: Create directory structure**

```bash
mkdir -p py/src/piper_py py/tests
```

**Step 2: Create pyproject.toml**

Create `py/pyproject.toml`:

```toml
[project]
name = "pied-piper"
version = "0.1.0"
description = "Python code guardrails for agentic coding workflows"
requires-python = ">=3.12"
dependencies = [
    "ruff>=0.11",
    "ty>=0.0.1a0",
    "import-linter",
    "vulture",
    "bandit",
    "xenon",
    "semgrep>=1.0.0",
]

[project.scripts]
pied-piper = "piper_py.cli:main"
piper = "piper_py.cli:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[dependency-groups]
dev = ["pytest"]
```

**Step 3: Create __init__.py**

Create `py/src/piper_py/__init__.py`:

```python
__version__ = "0.1.0"
```

**Step 4: Verify the package structure**

```bash
cd py && uv sync && cd ..
```

Expected: installs all dependencies into `.venv`

**Step 5: Commit**

```
feat(py): initialize Python package skeleton
```

---

## Task 2: Python runner module (TDD)

The runner is the core logic: execute a subprocess, capture output, format as OK/FAIL/SKIP.

**Files:**
- Create: `py/tests/test_runner.py`
- Create: `py/src/piper_py/runner.py`

**Step 1: Write failing tests for runner**

Create `py/tests/test_runner.py`:

```python
from unittest.mock import patch, MagicMock
import subprocess
from piper_py.runner import Check, run_check, run_checks


def test_run_check_success():
    check = Check(
        name="test:pass",
        command=["echo", "hello"],
        skip_if=lambda: False,
    )
    with patch("piper_py.runner.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        passed, output = run_check(check)
    assert passed is True
    assert output == "OK   test:pass"


def test_run_check_failure():
    check = Check(
        name="test:fail",
        command=["ruff", "check", "."],
        skip_if=lambda: False,
    )
    with patch("piper_py.runner.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(
            returncode=1,
            stdout="src/foo.py:1:1: F401 unused import\n",
            stderr="",
        )
        passed, output = run_check(check)
    assert passed is False
    assert "FAIL test:fail" in output
    assert "COMMAND ruff check ." in output
    assert "F401 unused import" in output


def test_run_check_skip():
    check = Check(
        name="test:skip",
        command=["echo"],
        skip_if=lambda: True,
    )
    passed, output = run_check(check)
    assert passed is True
    assert "SKIP test:skip" in output


def test_run_checks_all_pass():
    checks = [
        Check(name="a", command=["true"], skip_if=lambda: False),
        Check(name="b", command=["true"], skip_if=lambda: False),
    ]
    with patch("piper_py.runner.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        exit_code, outputs = run_checks(checks)
    assert exit_code == 0
    assert len(outputs) == 2


def test_run_checks_one_fails():
    checks = [
        Check(name="a", command=["true"], skip_if=lambda: False),
        Check(name="b", command=["false"], skip_if=lambda: False),
    ]
    returns = [
        MagicMock(returncode=0, stdout="", stderr=""),
        MagicMock(returncode=1, stdout="error", stderr=""),
    ]
    with patch("piper_py.runner.subprocess.run", side_effect=returns):
        exit_code, outputs = run_checks(checks)
    assert exit_code == 2
    assert "OK   a" in outputs[0]
    assert "FAIL b" in outputs[1]


def test_run_checks_continues_after_failure():
    """All checks run even if an earlier one fails."""
    checks = [
        Check(name="a", command=["false"], skip_if=lambda: False),
        Check(name="b", command=["true"], skip_if=lambda: False),
    ]
    returns = [
        MagicMock(returncode=1, stdout="err", stderr=""),
        MagicMock(returncode=0, stdout="", stderr=""),
    ]
    with patch("piper_py.runner.subprocess.run", side_effect=returns):
        exit_code, outputs = run_checks(checks)
    assert exit_code == 2
    assert len(outputs) == 2
    assert "FAIL a" in outputs[0]
    assert "OK   b" in outputs[1]
```

**Step 2: Run tests to verify they fail**

```bash
cd py && uv run pytest tests/test_runner.py -v
```

Expected: ImportError — `piper_py.runner` doesn't exist yet.

**Step 3: Implement runner**

Create `py/src/piper_py/runner.py`:

```python
from __future__ import annotations

import subprocess
from dataclasses import dataclass
from typing import Callable


@dataclass
class Check:
    name: str
    command: list[str]
    skip_if: Callable[[], bool]


def run_check(check: Check) -> tuple[bool, str]:
    if check.skip_if():
        return True, f"SKIP {check.name} (not applicable)"

    result = subprocess.run(check.command, capture_output=True, text=True)

    if result.returncode == 0:
        return True, f"OK   {check.name}"

    output = (result.stdout + result.stderr).rstrip()
    cmd_str = " ".join(check.command)
    return False, f"FAIL {check.name}\nCOMMAND {cmd_str}\n{output}"


def run_checks(checks: list[Check]) -> tuple[int, list[str]]:
    any_failed = False
    outputs: list[str] = []

    for check in checks:
        passed, output = run_check(check)
        outputs.append(output)
        if not passed:
            any_failed = True

    return 2 if any_failed else 0, outputs
```

**Step 4: Run tests to verify they pass**

```bash
cd py && uv run pytest tests/test_runner.py -v
```

Expected: all 6 tests PASS.

**Step 5: Commit**

```
feat(py): add runner module with OK/FAIL/SKIP output normalization
```

---

## Task 3: Python file detection helpers (TDD)

**Files:**
- Create: `py/tests/test_detect.py`
- Create: `py/src/piper_py/detect.py`

**Step 1: Write failing tests**

Create `py/tests/test_detect.py`:

```python
import os
import tempfile
from pathlib import Path

from piper_py.detect import has_files, has_config_section


def test_has_files_finds_py():
    with tempfile.TemporaryDirectory() as tmp:
        Path(tmp, "foo.py").touch()
        assert has_files({".py"}, root=tmp) is True


def test_has_files_empty_dir():
    with tempfile.TemporaryDirectory() as tmp:
        assert has_files({".py"}, root=tmp) is False


def test_has_files_excludes_venv():
    with tempfile.TemporaryDirectory() as tmp:
        venv = Path(tmp, ".venv")
        venv.mkdir()
        Path(venv, "lib.py").touch()
        assert has_files({".py"}, root=tmp) is False


def test_has_files_nested():
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp, "src", "pkg")
        src.mkdir(parents=True)
        Path(src, "main.py").touch()
        assert has_files({".py"}, root=tmp) is True


def test_has_config_section_found():
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp, "pyproject.toml")
        p.write_text("[tool.importlinter]\nroot = 'src'\n")
        assert has_config_section("pyproject.toml", "[tool.importlinter]", root=tmp) is True


def test_has_config_section_missing():
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp, "pyproject.toml")
        p.write_text("[project]\nname = 'foo'\n")
        assert has_config_section("pyproject.toml", "[tool.importlinter]", root=tmp) is False


def test_has_config_section_no_file():
    with tempfile.TemporaryDirectory() as tmp:
        assert has_config_section("pyproject.toml", "[tool.importlinter]", root=tmp) is False
```

**Step 2: Run tests to verify they fail**

```bash
cd py && uv run pytest tests/test_detect.py -v
```

Expected: ImportError.

**Step 3: Implement detect module**

Create `py/src/piper_py/detect.py`:

```python
from __future__ import annotations

import os
from pathlib import Path

EXCLUDE_DIRS = {
    ".venv", ".devenv", ".direnv", "node_modules", "dist", "build",
    ".next", "__pycache__", ".git", "tests", "test", "__tests__",
}


def has_files(extensions: set[str], root: str = ".") -> bool:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for f in filenames:
            if any(f.endswith(ext) for ext in extensions):
                return True
    return False


def has_config_section(filename: str, section: str, root: str = ".") -> bool:
    filepath = Path(root) / filename
    if not filepath.exists():
        return False
    return section in filepath.read_text()
```

**Step 4: Run tests to verify they pass**

```bash
cd py && uv run pytest tests/test_detect.py -v
```

Expected: all 7 tests PASS.

**Step 5: Commit**

```
feat(py): add file detection helpers for skip conditions
```

---

## Task 4: Python check definitions

**Files:**
- Create: `py/src/piper_py/checks.py`

This task has no TDD step — check definitions are declarative data, not logic. The logic (runner, detect) is already tested.

**Step 1: Create checks module**

Create `py/src/piper_py/checks.py`:

```python
from __future__ import annotations

from piper_py.detect import has_config_section, has_files
from piper_py.runner import Check

EXCLUDE_DIRS_CSV = ".venv,.devenv,.direnv,node_modules,dist,build,.next,__pycache__,.git,tests,test,__tests__"
EXCLUDE_DIRS_DOTSLASH = "./.venv,./.devenv,./.direnv,./node_modules,./dist,./build,./.next,./tests,./test"


def _no_py() -> bool:
    return not has_files({".py"})


def _no_importlinter() -> bool:
    return not has_config_section("pyproject.toml", "[tool.importlinter]")


def _no_semgrep_config() -> bool:
    return not has_config_section(".semgrep.yml", "rules:")


FAST_CHECKS: list[Check] = [
    Check(
        name="py:format",
        command=["ruff", "format", "--check", "."],
        skip_if=_no_py,
    ),
    Check(
        name="py:lint",
        command=["ruff", "check", "."],
        skip_if=_no_py,
    ),
    Check(
        name="py:type",
        command=[
            "ty", "check",
            "--exclude", ".venv/",
            "--exclude", ".devenv/",
            "--exclude", "node_modules/",
            "--exclude", "tests/",
            "--exclude", "test/",
            "--exclude", "test_*.py",
            "--exclude", "*_test.py",
            "--exclude", "conftest.py",
            ".",
        ],
        skip_if=_no_py,
    ),
]

FULL_ONLY_CHECKS: list[Check] = [
    Check(
        name="py:arch",
        command=["lint-imports", "--no-cache"],
        skip_if=_no_importlinter,
    ),
    Check(
        name="py:deadcode",
        command=["vulture", ".", "--min-confidence", "80", "--exclude", EXCLUDE_DIRS_CSV],
        skip_if=_no_py,
    ),
    Check(
        name="py:security",
        command=["bandit", "-r", ".", "-q", "-ll", "--exclude", EXCLUDE_DIRS_DOTSLASH],
        skip_if=_no_py,
    ),
    Check(
        name="py:complexity",
        command=["xenon", "--max-absolute", "B", "--max-modules", "A", "--max-average", "A", "--exclude", EXCLUDE_DIRS_CSV, "."],
        skip_if=_no_py,
    ),
    Check(
        name="py:semgrep",
        command=[
            "semgrep", "scan",
            "--config", ".semgrep.yml",
            "--quiet", "--error", "--metrics=off",
            "--exclude", ".venv", "--exclude", ".devenv",
            "--exclude", "node_modules", "--exclude", "dist",
            "--exclude", "build", "--exclude", "tests",
            "--exclude", "test", "--exclude", "__tests__",
            "--exclude", "*_test.py", "--exclude", "test_*.py",
            "--exclude", "*.test.*", "--exclude", "*.spec.*",
            "--exclude", "conftest.py",
            ".",
        ],
        skip_if=_no_semgrep_config,
    ),
]

FULL_CHECKS = FAST_CHECKS + FULL_ONLY_CHECKS
```

**Step 2: Verify module loads**

```bash
cd py && uv run python -c "from piper_py.checks import FAST_CHECKS, FULL_CHECKS; print(f'{len(FAST_CHECKS)} fast, {len(FULL_CHECKS)} full')"
```

Expected: `3 fast, 8 full`

**Step 3: Commit**

```
feat(py): define all Python check commands and skip conditions
```

---

## Task 5: Python CLI entry point (TDD)

**Files:**
- Create: `py/tests/test_cli.py`
- Create: `py/src/piper_py/cli.py`

**Step 1: Write failing tests**

Create `py/tests/test_cli.py`:

```python
import subprocess
import sys


def test_cli_version():
    result = subprocess.run(
        [sys.executable, "-m", "piper_py.cli", "version"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0
    assert "pied-piper" in result.stdout


def test_cli_help():
    result = subprocess.run(
        [sys.executable, "-m", "piper_py.cli", "--help"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0
    assert "check-fast" in result.stdout


def test_cli_unknown_command():
    result = subprocess.run(
        [sys.executable, "-m", "piper_py.cli", "nonsense"],
        capture_output=True, text=True,
    )
    assert result.returncode != 0
```

**Step 2: Run tests to verify they fail**

```bash
cd py && uv run pytest tests/test_cli.py -v
```

Expected: ModuleNotFoundError or error from missing `cli.py`.

**Step 3: Implement CLI**

Create `py/src/piper_py/cli.py`:

```python
from __future__ import annotations

import argparse
import subprocess
import sys

from piper_py import __version__
from piper_py.checks import FAST_CHECKS, FULL_CHECKS
from piper_py.runner import run_checks


def _fix() -> None:
    subprocess.run(["ruff", "format", "."], check=False)
    subprocess.run(["ruff", "check", "--fix", "."], check=False)
    print("OK   fix")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="pied-piper",
        description="Python code guardrails for agentic coding workflows",
    )
    parser.add_argument(
        "command",
        choices=["check-fast", "check-full", "fix", "version"],
    )
    args = parser.parse_args(argv)

    if args.command == "version":
        print(f"pied-piper {__version__}")
        return

    if args.command == "fix":
        _fix()
        return

    checks = FAST_CHECKS if args.command == "check-fast" else FULL_CHECKS
    exit_code, outputs = run_checks(checks)
    for output in outputs:
        print(output)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
```

**Step 4: Run tests to verify they pass**

```bash
cd py && uv run pytest tests/test_cli.py -v
```

Expected: all 3 tests PASS.

**Step 5: Test the entry point script**

```bash
cd py && uv run pied-piper version
```

Expected: `pied-piper 0.1.0`

**Step 6: Commit**

```
feat(py): add CLI entry point with check-fast, check-full, fix, version
```

---

## Task 6: Python integration smoke test

**Files:**
- Create: `py/tests/test_integration.py`

**Step 1: Write integration test**

Create `py/tests/test_integration.py`. This runs the real tool against a temporary project.

```python
import subprocess
import sys
import tempfile
from pathlib import Path


def test_check_fast_on_clean_python_file():
    with tempfile.TemporaryDirectory() as tmp:
        Path(tmp, "hello.py").write_text('def greet() -> str:\n    return "hello"\n')
        result = subprocess.run(
            [sys.executable, "-m", "piper_py.cli", "check-fast"],
            capture_output=True, text=True, cwd=tmp,
        )
        assert "py:format" in result.stdout
        assert "py:lint" in result.stdout


def test_check_fast_skips_when_no_py_files():
    with tempfile.TemporaryDirectory() as tmp:
        result = subprocess.run(
            [sys.executable, "-m", "piper_py.cli", "check-fast"],
            capture_output=True, text=True, cwd=tmp,
        )
        assert result.returncode == 0
        assert "SKIP" in result.stdout


def test_check_fast_catches_lint_error():
    with tempfile.TemporaryDirectory() as tmp:
        Path(tmp, "bad.py").write_text("import os\n")  # unused import
        result = subprocess.run(
            [sys.executable, "-m", "piper_py.cli", "check-fast"],
            capture_output=True, text=True, cwd=tmp,
        )
        assert result.returncode == 2
        assert "FAIL" in result.stdout
```

**Step 2: Run integration tests**

```bash
cd py && uv run pytest tests/test_integration.py -v
```

Expected: all 3 PASS (tools are installed as package dependencies).

**Step 3: Commit**

```
test(py): add integration smoke tests for CLI
```

---

## Task 7: TypeScript package skeleton

**Files:**
- Create: `ts/package.json`
- Create: `ts/tsconfig.json`

**Step 1: Create directory structure**

```bash
mkdir -p ts/src ts/tests
```

**Step 2: Create package.json**

Create `ts/package.json`:

```json
{
  "name": "pied-piper",
  "version": "0.1.0",
  "description": "TypeScript code guardrails for agentic coding workflows",
  "type": "module",
  "bin": {
    "pied-piper": "./dist/cli.js",
    "piper": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "files": [
    "dist/"
  ],
  "dependencies": {
    "@ast-grep/cli": "^0.41.0",
    "@biomejs/biome": "^2.4.4",
    "dependency-cruiser": "^17.3.8",
    "knip": "^5.85.0",
    "type-coverage": "^2.29.7",
    "typescript": "^5.9.3"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  }
}
```

**Step 3: Create tsconfig.json**

Create `ts/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noEmit": false,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 4: Install dependencies**

```bash
cd ts && npm install
```

**Step 5: Commit**

```
feat(ts): initialize TypeScript package skeleton
```

---

## Task 8: TypeScript runner module (TDD)

**Files:**
- Create: `ts/tests/runner.test.ts`
- Create: `ts/src/runner.ts`

**Step 1: Write failing tests**

Create `ts/tests/runner.test.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

```bash
cd ts && npx vitest run tests/runner.test.ts
```

Expected: cannot resolve `../src/runner.js`.

**Step 3: Implement runner**

Create `ts/src/runner.ts`:

```typescript
import { execSync } from "node:child_process";

export interface Check {
  name: string;
  command: string;
  skipIf: () => boolean;
}

export function runCheck(check: Check): [boolean, string] {
  if (check.skipIf()) {
    return [true, `SKIP ${check.name} (not applicable)`];
  }

  try {
    execSync(check.command, { stdio: "pipe" });
    return [true, `OK   ${check.name}`];
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer; stderr?: Buffer };
    const stdout = e.stdout?.toString() ?? "";
    const stderr = e.stderr?.toString() ?? "";
    const output = (stdout + stderr).trimEnd();
    return [false, `FAIL ${check.name}\nCOMMAND ${check.command}\n${output}`];
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
```

**Step 4: Run tests to verify they pass**

```bash
cd ts && npx vitest run tests/runner.test.ts
```

Expected: all 6 tests PASS.

**Step 5: Commit**

```
feat(ts): add runner module with OK/FAIL/SKIP output normalization
```

---

## Task 9: TypeScript file detection helpers (TDD)

**Files:**
- Create: `ts/tests/detect.test.ts`
- Create: `ts/src/detect.ts`

**Step 1: Write failing tests**

Create `ts/tests/detect.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { hasFiles, hasConfigFile } from "../src/detect.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "piper-test-"));
}

describe("hasFiles", () => {
  it("finds .ts files", () => {
    const tmp = makeTmpDir();
    fs.writeFileSync(path.join(tmp, "foo.ts"), "");
    expect(hasFiles([".ts"], tmp)).toBe(true);
    fs.rmSync(tmp, { recursive: true });
  });

  it("returns false for empty dir", () => {
    const tmp = makeTmpDir();
    expect(hasFiles([".ts"], tmp)).toBe(false);
    fs.rmSync(tmp, { recursive: true });
  });

  it("excludes node_modules", () => {
    const tmp = makeTmpDir();
    const nm = path.join(tmp, "node_modules");
    fs.mkdirSync(nm);
    fs.writeFileSync(path.join(nm, "dep.ts"), "");
    expect(hasFiles([".ts"], tmp)).toBe(false);
    fs.rmSync(tmp, { recursive: true });
  });

  it("finds nested files", () => {
    const tmp = makeTmpDir();
    const nested = path.join(tmp, "src", "components");
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, "App.tsx"), "");
    expect(hasFiles([".tsx"], tmp)).toBe(true);
    fs.rmSync(tmp, { recursive: true });
  });
});

describe("hasConfigFile", () => {
  it("returns true when file exists", () => {
    const tmp = makeTmpDir();
    fs.writeFileSync(path.join(tmp, "biome.json"), "{}");
    expect(hasConfigFile("biome.json", tmp)).toBe(true);
    fs.rmSync(tmp, { recursive: true });
  });

  it("returns false when file missing", () => {
    const tmp = makeTmpDir();
    expect(hasConfigFile("biome.json", tmp)).toBe(false);
    fs.rmSync(tmp, { recursive: true });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd ts && npx vitest run tests/detect.test.ts
```

Expected: cannot resolve `../src/detect.js`.

**Step 3: Implement detect module**

Create `ts/src/detect.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";

const EXCLUDE_DIRS = new Set([
  ".venv", ".devenv", ".direnv", "node_modules", "dist", "build",
  ".next", "__pycache__", ".git", "tests", "test", "__tests__",
]);

export function hasFiles(extensions: string[], root: string = "."): boolean {
  function walk(dir: string): boolean {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name)) {
          if (walk(path.join(dir, entry.name))) return true;
        }
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        return true;
      }
    }
    return false;
  }
  return walk(root);
}

export function hasConfigFile(filename: string, root: string = "."): boolean {
  return fs.existsSync(path.join(root, filename));
}
```

**Step 4: Run tests to verify they pass**

```bash
cd ts && npx vitest run tests/detect.test.ts
```

Expected: all 6 tests PASS.

**Step 5: Commit**

```
feat(ts): add file detection helpers for skip conditions
```

---

## Task 10: TypeScript check definitions

**Files:**
- Create: `ts/src/checks.ts`

**Step 1: Create checks module**

Create `ts/src/checks.ts`:

```typescript
import { type Check } from "./runner.js";
import { hasFiles, hasConfigFile } from "./detect.js";

const noTsJsFiles = (): boolean => !hasFiles([".ts", ".tsx", ".js", ".jsx"]);
const noTsFiles = (): boolean => !hasFiles([".ts"]);
const noTsSrc = (): boolean => !hasFiles([".ts"], "src");
const noDepCruiserConfig = (): boolean => !hasConfigFile(".dependency-cruiser.js") || !hasConfigFile("src");
const noSgConfig = (): boolean => !hasConfigFile("sgconfig.yml");

export const FAST_CHECKS: Check[] = [
  {
    name: "ts:format",
    command: "biome format .",
    skipIf: noTsJsFiles,
  },
  {
    name: "ts:lint",
    command: "biome lint .",
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
    command: 'depcruise src/ --config .dependency-cruiser.js --exclude "(test|tests|__tests__|\\.(test|spec)\\.)"',
    skipIf: noDepCruiserConfig,
  },
  {
    name: "ts:deadcode",
    command: "knip --exclude files",
    skipIf: noTsSrc,
  },
  {
    name: "ts:typecov",
    command: 'type-coverage --at-least 80 --ignore-files "**/*.test.ts" --ignore-files "**/*.spec.ts" --ignore-files "**/tests/**" --ignore-files "**/test/**" --ignore-files "**/__tests__/**"',
    skipIf: noTsSrc,
  },
  {
    name: "ts:astgrep",
    command: "ast-grep scan --config sgconfig.yml",
    skipIf: noSgConfig,
  },
];

export const FULL_CHECKS: Check[] = [...FAST_CHECKS, ...FULL_ONLY_CHECKS];
```

**Step 2: Verify module compiles**

```bash
cd ts && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```
feat(ts): define all TypeScript check commands and skip conditions
```

---

## Task 11: TypeScript CLI entry point (TDD)

**Files:**
- Create: `ts/tests/cli.test.ts`
- Create: `ts/src/cli.ts`

**Step 1: Write failing tests**

Create `ts/tests/cli.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import * as path from "node:path";

const cli = path.resolve("src/cli.ts");

function run(args: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`npx tsx ${cli} ${args}`, {
      stdio: "pipe",
      encoding: "utf-8",
    });
    return { stdout, exitCode: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? "", exitCode: err.status ?? 1 };
  }
}

describe("CLI", () => {
  it("prints version", () => {
    const { stdout, exitCode } = run("version");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("pied-piper");
  });

  it("shows help", () => {
    const { stdout, exitCode } = run("--help");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("check-fast");
    expect(stdout).toContain("check-full");
  });

  it("rejects unknown commands", () => {
    const { exitCode } = run("nonsense");
    expect(exitCode).not.toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd ts && npm install tsx --save-dev && npx vitest run tests/cli.test.ts
```

Expected: fail — `src/cli.ts` doesn't exist.

**Step 3: Implement CLI**

Create `ts/src/cli.ts`:

```typescript
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
  try { execSync("biome format --write .", { stdio: "pipe" }); } catch {}
  try { execSync("biome lint --write .", { stdio: "pipe" }); } catch {}
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
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run 'pied-piper --help' for usage");
      process.exit(1);
  }
}

main();
```

**Step 4: Run tests to verify they pass**

```bash
cd ts && npx vitest run tests/cli.test.ts
```

Expected: all 3 tests PASS.

**Step 5: Build and verify the compiled entry point**

```bash
cd ts && npm run build && node dist/cli.js version
```

Expected: `pied-piper 0.1.0`

**Step 6: Commit**

```
feat(ts): add CLI entry point with check-fast, check-full, fix, version
```

---

## Task 12: TypeScript integration smoke test

**Files:**
- Create: `ts/tests/integration.test.ts`

**Step 1: Write integration test**

Create `ts/tests/integration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "piper-ts-test-"));
}

const cli = path.resolve("src/cli.ts");

function runCli(command: string, cwd: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`npx tsx ${cli} ${command}`, {
      stdio: "pipe",
      encoding: "utf-8",
      cwd,
    });
    return { stdout, exitCode: 0 };
  } catch (err: any) {
    return { stdout: (err.stdout ?? "") + (err.stderr ?? ""), exitCode: err.status ?? 1 };
  }
}

describe("integration", () => {
  it("skips all checks when no TS/JS files", () => {
    const tmp = makeTmpDir();
    const { stdout, exitCode } = runCli("check-fast", tmp);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("SKIP");
    fs.rmSync(tmp, { recursive: true });
  });
});
```

**Step 2: Run integration test**

```bash
cd ts && npx vitest run tests/integration.test.ts
```

Expected: PASS.

**Step 3: Commit**

```
test(ts): add integration smoke test for CLI
```

---

## Task 13: Delete old infrastructure

**Files:**
- Delete: `Dockerfile`
- Delete: `docker/entrypoint.sh`
- Delete: `docker/pyproject.toml`
- Delete: `bin/pied-piper`
- Delete: `install.sh`
- Delete: `Justfile`
- Delete: `scripts/run-check.sh`
- Delete: `.github/workflows/docker-publish.yml`
- Delete: `biome.json` (moves into ts/ context)
- Delete: `tsconfig.json` (moves into ts/ context)
- Delete: `sgconfig.yml` (project-specific, not ours)
- Delete: `.semgrep.yml` (project-specific, not ours)
- Delete: `devenv.nix` (no longer needed for Just)
- Delete: `pied_piper/__init__.py` (old package stub)
- Delete: root `pyproject.toml` (replaced by `py/pyproject.toml`)
- Delete: root `package.json` (replaced by `ts/package.json`)

**Step 1: Remove all old files**

```bash
git rm Dockerfile docker/entrypoint.sh docker/pyproject.toml bin/pied-piper install.sh Justfile scripts/run-check.sh .github/workflows/docker-publish.yml biome.json tsconfig.json sgconfig.yml .semgrep.yml pied_piper/__init__.py pyproject.toml package.json package-lock.json uv.lock
rmdir docker bin scripts .github/workflows .github pied_piper rules 2>/dev/null || true
```

**Step 2: Verify nothing is broken**

```bash
cd py && uv run pytest -v && cd ../ts && npx vitest run
```

Expected: all tests pass in both packages.

**Step 3: Commit**

```
refactor: remove Docker, Just, and shell script infrastructure

Replaced by two self-contained CLI tools in py/ and ts/.
```

---

## Task 14: Update documentation

**Files:**
- Modify: `docs/README.md`

**Step 1: Rewrite docs/README.md**

Replace the content of `docs/README.md` with updated documentation covering:

- What pied-piper is (guardrails orchestrator for Claude Code)
- Quick start for Python: `uvx pied-piper check-fast`
- Quick start for TypeScript: `npx pied-piper check-fast`
- Hook configuration (PostToolUse + Stop examples)
- Command reference (check-fast, check-full, fix, version)
- Check reference tables (what each check does, skip conditions)
- Permanent install instructions (`uv tool install pied-piper` / `npm install -g pied-piper`)

Keep `docs/tools.md` — it's still accurate for the underlying tools.

**Step 2: Update root README.md if it exists**

Add a brief top-level README pointing to `docs/README.md`.

**Step 3: Commit**

```
docs: update documentation for uvx/npx distribution model
```

---

## Execution Notes

**Tasks 1-6 (Python tool) and Tasks 7-12 (TypeScript tool) are independent** — they can be executed in parallel by separate agents.

**Task 13 (cleanup) depends on both tools being complete** — don't delete old infrastructure until both tools are tested.

**Task 14 (docs) depends on Task 13.**

**Dependency graph:**

```
Tasks 1→2→3→4→5→6 ─┐
                     ├→ Task 13 → Task 14
Tasks 7→8→9→10→11→12┘
```
