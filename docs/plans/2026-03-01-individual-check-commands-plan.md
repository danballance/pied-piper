# Individual Check Commands Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify all check commands under `pied-piper check <name>` — supporting `fast`, `full`, and individual check names like `format`, `lint`, `type`, etc.

**Architecture:** Replace the flat `choices=` argparse CLI with subparsers. Add a lookup dict in `checks.py` mapping short names to `Check` objects. The `check` subcommand resolves `fast`/`full` to check lists, individual names to single checks, and unknown names to an error with available names.

**Tech Stack:** Python 3.12+, argparse, pytest

---

### Task 1: Add `ALL_CHECKS_BY_NAME` lookup dict to `checks.py`

**Files:**
- Modify: `py/src/piper_py/checks.py:97` (after `FULL_CHECKS`)
- Test: `py/tests/test_checks.py` (create)

**Step 1: Write the failing test**

Create `py/tests/test_checks.py`:

```python
from piper_py.checks import ALL_CHECKS_BY_NAME, FULL_CHECKS


def test_all_checks_by_name_has_all_checks():
    assert len(ALL_CHECKS_BY_NAME) == len(FULL_CHECKS)


def test_all_checks_by_name_strips_prefix():
    for name in ALL_CHECKS_BY_NAME:
        assert ":" not in name


def test_all_checks_by_name_contains_expected_keys():
    expected = {"format", "lint", "type", "arch", "deadcode", "security", "complexity", "semgrep"}
    assert set(ALL_CHECKS_BY_NAME.keys()) == expected
```

**Step 2: Run test to verify it fails**

Run: `cd py && uv run pytest tests/test_checks.py -v`
Expected: FAIL — `ImportError: cannot import name 'ALL_CHECKS_BY_NAME'`

**Step 3: Write minimal implementation**

Add to the bottom of `py/src/piper_py/checks.py` (after line 97):

```python
ALL_CHECKS_BY_NAME: dict[str, Check] = {
    c.name.removeprefix("py:"): c for c in FULL_CHECKS
}
```

**Step 4: Run test to verify it passes**

Run: `cd py && uv run pytest tests/test_checks.py -v`
Expected: 3 passed

**Step 5: Commit**

```bash
git add py/src/piper_py/checks.py py/tests/test_checks.py
git commit -m "feat: add ALL_CHECKS_BY_NAME lookup dict"
```

---

### Task 2: Rewrite CLI to use argparse subparsers

**Files:**
- Modify: `py/src/piper_py/cli.py` (full rewrite)
- Test: `py/tests/test_cli.py` (rewrite)

**Step 1: Write the failing tests**

Replace `py/tests/test_cli.py` with:

```python
from piper_py.cli import main
import pytest


def test_check_fast(capsys):
    """'check fast' runs fast checks and exits cleanly when mocked."""
    # Just verify the CLI parses "check fast" without error
    # Integration tests cover actual check execution
    with pytest.raises(SystemExit) as exc_info:
        main(["check", "fast"])
    # Exit 0 (all skipped/passed) or 2 (failure) — both are valid parses
    assert exc_info.value.code in (0, 2)


def test_check_full(capsys):
    with pytest.raises(SystemExit) as exc_info:
        main(["check", "full"])
    assert exc_info.value.code in (0, 2)


def test_check_individual(capsys):
    """'check format' runs a single check."""
    with pytest.raises(SystemExit) as exc_info:
        main(["check", "format"])
    assert exc_info.value.code in (0, 2)


def test_check_invalid_name(capsys):
    """'check bogus' prints error with available names and exits 1."""
    with pytest.raises(SystemExit) as exc_info:
        main(["check", "bogus"])
    assert exc_info.value.code == 1
    captured = capsys.readouterr()
    assert "bogus" in captured.err
    assert "format" in captured.err


def test_check_no_name(capsys):
    """'check' with no name prints error and exits 1."""
    with pytest.raises(SystemExit) as exc_info:
        main(["check"])
    assert exc_info.value.code == 1
    captured = capsys.readouterr()
    assert "format" in captured.err


def test_version(capsys):
    main(["version"])
    captured = capsys.readouterr()
    assert "pied-piper" in captured.out


def test_fix(capsys):
    """'fix' parses without error (actual fix runs ruff on cwd)."""
    # fix always exits normally (no sys.exit call)
    main(["fix"])


def test_no_command(capsys):
    """No arguments prints usage and exits 2."""
    with pytest.raises(SystemExit) as exc_info:
        main([])
    assert exc_info.value.code != 0
```

**Step 2: Run tests to verify they fail**

Run: `cd py && uv run pytest tests/test_cli.py -v`
Expected: FAIL — old CLI doesn't accept `check fast` syntax

**Step 3: Write the new CLI**

Replace `py/src/piper_py/cli.py` with:

```python
from __future__ import annotations

import sys
import subprocess

from piper_py import __version__
from piper_py.checks import ALL_CHECKS_BY_NAME, FAST_CHECKS, FULL_CHECKS
from piper_py.runner import run_check, run_checks


def _fix() -> None:
    subprocess.run(["ruff", "format", "."], check=False)
    subprocess.run(["ruff", "check", "--fix", "."], check=False)
    print("OK   fix")


def _check(name: str) -> None:
    if name == "fast":
        exit_code, outputs = run_checks(FAST_CHECKS)
        for output in outputs:
            print(output)
        sys.exit(exit_code)

    if name == "full":
        exit_code, outputs = run_checks(FULL_CHECKS)
        for output in outputs:
            print(output)
        sys.exit(exit_code)

    check = ALL_CHECKS_BY_NAME.get(name)
    if check is None:
        available = ", ".join(sorted(ALL_CHECKS_BY_NAME.keys()))
        print(f"error: unknown check '{name}'", file=sys.stderr)
        print(f"available checks: fast, full, {available}", file=sys.stderr)
        sys.exit(1)

    passed, output = run_check(check)
    print(output)
    sys.exit(0 if passed else 2)


def main(argv: list[str] | None = None) -> None:
    args = argv if argv is not None else sys.argv[1:]

    if not args:
        print("usage: pied-piper {check,fix,version} ...", file=sys.stderr)
        sys.exit(2)

    command = args[0]

    if command == "version":
        print(f"pied-piper {__version__}")
        return

    if command == "fix":
        _fix()
        return

    if command == "check":
        if len(args) < 2:
            available = ", ".join(sorted(ALL_CHECKS_BY_NAME.keys()))
            print("error: missing check name", file=sys.stderr)
            print(f"available checks: fast, full, {available}", file=sys.stderr)
            sys.exit(1)
        _check(args[1])
        return

    print(f"error: unknown command '{command}'", file=sys.stderr)
    print("usage: pied-piper {check,fix,version} ...", file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()
```

Note: We drop argparse entirely — the command surface is simple enough that manual parsing is cleaner and gives us full control over error messages. No subparser overhead.

**Step 4: Run tests to verify they pass**

Run: `cd py && uv run pytest tests/test_cli.py -v`
Expected: All passed

**Step 5: Commit**

```bash
git add py/src/piper_py/cli.py py/tests/test_cli.py
git commit -m "feat: restructure CLI to check subcommand with individual check support"
```

---

### Task 3: Update integration tests for new CLI syntax

**Files:**
- Modify: `py/tests/test_integration.py`

**Step 1: Update integration tests**

The integration tests use the old `check-fast` and `check-full` commands. Update them to use the new `check fast` and `check full` syntax.

In `py/tests/test_integration.py`, make these replacements:
- `"check-fast"` → `"check", "fast"`
- `"check-full"` → `"check", "full"`

The specific changes (every `subprocess.run` call):

```python
# Line 13: change
[sys.executable, "-m", "piper_py.cli", "check-fast"],
# to
[sys.executable, "-m", "piper_py.cli", "check", "fast"],

# Line 22: change
[sys.executable, "-m", "piper_py.cli", "check-fast"],
# to
[sys.executable, "-m", "piper_py.cli", "check", "fast"],

# Line 32: change
[sys.executable, "-m", "piper_py.cli", "check-fast"],
# to
[sys.executable, "-m", "piper_py.cli", "check", "fast"],

# Line 44: change
[sys.executable, "-m", "piper_py.cli", "check-full"],
# to
[sys.executable, "-m", "piper_py.cli", "check", "full"],

# Line 68: change
[sys.executable, "-m", "piper_py.cli", "check-full"],
# to
[sys.executable, "-m", "piper_py.cli", "check", "full"],
```

**Step 2: Add an integration test for individual check**

Add to the end of `py/tests/test_integration.py`:

```python
def test_check_individual_format_on_clean_file():
    with tempfile.TemporaryDirectory() as tmp:
        Path(tmp, "hello.py").write_text('def greet() -> str:\n    return "hello"\n')
        result = subprocess.run(
            [sys.executable, "-m", "piper_py.cli", "check", "format"],
            capture_output=True, text=True, cwd=tmp,
        )
        assert result.returncode == 0
        assert "OK   py:format" in result.stdout


def test_check_individual_lint_catches_error():
    with tempfile.TemporaryDirectory() as tmp:
        Path(tmp, "bad.py").write_text("import os\n")
        result = subprocess.run(
            [sys.executable, "-m", "piper_py.cli", "check", "lint"],
            capture_output=True, text=True, cwd=tmp,
        )
        assert result.returncode == 2
        assert "FAIL py:lint" in result.stdout
```

**Step 3: Run all integration tests**

Run: `cd py && uv run pytest tests/test_integration.py -v`
Expected: All passed

**Step 4: Run full test suite**

Run: `cd py && uv run pytest -v`
Expected: All passed

**Step 5: Commit**

```bash
git add py/tests/test_integration.py
git commit -m "test: update integration tests for new check subcommand syntax"
```

---

### Task 4: Update documentation

**Files:**
- Modify: `docs/README.md`

**Step 1: Update docs/README.md**

Update all references to the old CLI syntax:

1. Quick Start section: `check-fast` → `check fast`, `check-full` → `check full`
2. Hook Configuration: `check-fast` → `check fast`, `check-full` → `check full`
3. Commands table: replace `check-fast`/`check-full` rows with `check fast`, `check full`, and `check <name>`
4. "Run via" example: `uvx pied-piper <command>` stays, but update examples

The Commands table should become:

```markdown
| Command | What it runs | When to use |
|---------|-------------|-------------|
| `check fast` | format + lint + type check | Every edit (PostToolUse) |
| `check full` | fast + arch + deadcode + security/complexity | Before agent stops (Stop hook) |
| `check <name>` | A single check (e.g. `format`, `type`, `security`) | Re-run one failing check |
| `fix` | Auto-fix formatting and lint | Manual cleanup |
| `version` | Print version | Troubleshooting |
```

**Step 2: Verify no stale references remain**

Run: `grep -r "check-fast\|check-full" docs/`
Expected: No matches

**Step 3: Commit**

```bash
git add docs/README.md
git commit -m "docs: update README for new check subcommand syntax"
```
