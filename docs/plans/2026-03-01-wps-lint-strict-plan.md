# wemake-python-styleguide (`py:lint-strict`) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `py:lint-strict` check (wemake-python-styleguide via flake8) and `check strict` group command as an opt-in stricter linting tier.

**Architecture:** New `STRICT_ONLY_CHECKS` list containing the `py:lint-strict` check, composed into `STRICT_CHECKS = FULL_CHECKS + STRICT_ONLY_CHECKS`. CLI gains `check strict` group and `check lint-strict` individual command. Dependencies `flake8` and `wemake-python-styleguide` added to pyproject.toml.

**Tech Stack:** Python 3.12+, flake8, wemake-python-styleguide, pytest

---

### Task 1: Add dependencies to pyproject.toml

**Files:**
- Modify: `py/pyproject.toml:6-13`

**Step 1: Add flake8 and wemake-python-styleguide**

In `py/pyproject.toml`, add to the `dependencies` list:

```toml
dependencies = [
    "ruff>=0.11",
    "ty>=0.0.1a0",
    "import-linter",
    "vulture",
    "bandit",
    "complexipy>=5.0",
    "flake8",
    "wemake-python-styleguide",
]
```

**Step 2: Lock dependencies**

Run: `cd py && uv lock`
Expected: Lock file updated successfully

**Step 3: Verify flake8 with WPS works**

Run: `cd py && uv run flake8 --select=WPS --version`
Expected: Shows flake8 version with wemake-python-styleguide loaded

**Step 4: Commit**

```bash
git add py/pyproject.toml py/uv.lock
git commit -m "deps: add flake8 and wemake-python-styleguide"
```

---

### Task 2: Add `STRICT_ONLY_CHECKS` and `STRICT_CHECKS` to checks.py

**Files:**
- Modify: `py/src/piper_py/checks.py:97-101`
- Test: `py/tests/test_checks.py`

**Step 1: Write the failing tests**

Add to `py/tests/test_checks.py`:

```python
from piper_py.checks import ALL_CHECKS_BY_NAME, FULL_CHECKS, STRICT_CHECKS, STRICT_ONLY_CHECKS


def test_strict_only_checks_has_lint_strict():
    names = [c.name for c in STRICT_ONLY_CHECKS]
    assert names == ["py:lint-strict"]


def test_strict_checks_includes_full_and_strict_only():
    assert STRICT_CHECKS == FULL_CHECKS + STRICT_ONLY_CHECKS


def test_all_checks_by_name_contains_lint_strict():
    assert "lint-strict" in ALL_CHECKS_BY_NAME
```

Also update the existing tests to account for the new check:

```python
def test_all_checks_by_name_has_all_checks():
    assert len(ALL_CHECKS_BY_NAME) == len(FULL_CHECKS) + len(STRICT_ONLY_CHECKS)


def test_all_checks_by_name_contains_expected_keys():
    expected = {"format", "lint", "type", "arch", "deadcode", "security", "complexity", "semgrep", "lint-strict"}
    assert set(ALL_CHECKS_BY_NAME.keys()) == expected
```

**Step 2: Run tests to verify they fail**

Run: `cd py && uv run pytest tests/test_checks.py -v`
Expected: FAIL — `ImportError: cannot import name 'STRICT_CHECKS'`

**Step 3: Write minimal implementation**

Add to `py/src/piper_py/checks.py`, after `FULL_CHECKS` (line 97) and before `ALL_CHECKS_BY_NAME`:

```python
STRICT_ONLY_CHECKS: list[Check] = [
    Check(
        name="py:lint-strict",
        command=[
            "flake8", ".", "--select=WPS",
            "--extend-exclude", ",".join(EXCLUDE_DIRS),
        ],
        skip_if=_no_py,
    ),
]

STRICT_CHECKS = FULL_CHECKS + STRICT_ONLY_CHECKS
```

Update `ALL_CHECKS_BY_NAME` to include strict checks:

```python
ALL_CHECKS_BY_NAME: dict[str, Check] = {
    c.name.removeprefix("py:"): c for c in FULL_CHECKS + STRICT_ONLY_CHECKS
}
```

**Step 4: Run tests to verify they pass**

Run: `cd py && uv run pytest tests/test_checks.py -v`
Expected: All passed

**Step 5: Commit**

```bash
git add py/src/piper_py/checks.py py/tests/test_checks.py
git commit -m "feat: add STRICT_ONLY_CHECKS with py:lint-strict (wemake-python-styleguide)"
```

---

### Task 3: Add `check strict` to CLI

**Files:**
- Modify: `py/src/piper_py/cli.py:7,17-28,30-35,60-64`
- Test: `py/tests/test_cli.py`

**Step 1: Write the failing tests**

Add to `py/tests/test_cli.py`:

```python
def test_check_strict(capsys):
    """'check strict' runs strict checks and exits cleanly."""
    with pytest.raises(SystemExit) as exc_info:
        main(["check", "strict"])
    assert exc_info.value.code in (0, 2)


def test_check_lint_strict_individual(capsys):
    """'check lint-strict' runs the individual WPS check."""
    with pytest.raises(SystemExit) as exc_info:
        main(["check", "lint-strict"])
    assert exc_info.value.code in (0, 2)
```

Also update `test_check_invalid_name` to verify `strict` appears in error help:

```python
def test_check_invalid_name(capsys):
    """'check bogus' prints error with available names and exits 1."""
    with pytest.raises(SystemExit) as exc_info:
        main(["check", "bogus"])
    assert exc_info.value.code == 1
    captured = capsys.readouterr()
    assert "bogus" in captured.err
    assert "format" in captured.err
    assert "strict" in captured.err
```

**Step 2: Run tests to verify they fail**

Run: `cd py && uv run pytest tests/test_cli.py::test_check_strict tests/test_cli.py::test_check_lint_strict_individual -v`
Expected: FAIL — `check strict` not recognized

**Step 3: Write minimal implementation**

In `py/src/piper_py/cli.py`:

Update the import (line 7):

```python
from piper_py.checks import ALL_CHECKS_BY_NAME, FAST_CHECKS, FULL_CHECKS, STRICT_CHECKS
```

Add a `strict` branch in `_check()`, after the `full` branch:

```python
    if name == "strict":
        exit_code, outputs = run_checks(STRICT_CHECKS)
        for output in outputs:
            print(output)
        sys.exit(exit_code)
```

Update the error messages to include `strict` as a group option. In `_check()`:

```python
        print(f"available checks: fast, full, strict, {available}", file=sys.stderr)
```

And in `main()`:

```python
            print(f"available checks: fast, full, strict, {available}", file=sys.stderr)
```

**Step 4: Run tests to verify they pass**

Run: `cd py && uv run pytest tests/test_cli.py -v`
Expected: All passed

**Step 5: Commit**

```bash
git add py/src/piper_py/cli.py py/tests/test_cli.py
git commit -m "feat: add check strict group command to CLI"
```

---

### Task 4: Add integration tests

**Files:**
- Modify: `py/tests/test_integration.py`

**Step 1: Add integration test for lint-strict on clean file**

Add to `py/tests/test_integration.py`:

```python
def test_check_lint_strict_on_clean_file():
    with tempfile.TemporaryDirectory() as tmp:
        Path(tmp, "hello.py").write_text('def greet() -> str:\n    return "hello"\n')
        result = subprocess.run(
            [sys.executable, "-m", "piper_py.cli", "check", "lint-strict"],
            capture_output=True,
            text=True,
            cwd=tmp,
        )
        # WPS may or may not flag this simple file — just verify output format
        assert "py:lint-strict" in result.stdout


def test_check_strict_runs_full_plus_lint_strict():
    """check strict includes both full checks and lint-strict."""
    with tempfile.TemporaryDirectory() as tmp:
        Path(tmp, "hello.py").write_text('def greet() -> str:\n    return "hello"\n')
        result = subprocess.run(
            [sys.executable, "-m", "piper_py.cli", "check", "strict"],
            capture_output=True,
            text=True,
            cwd=tmp,
        )
        # Should include checks from full AND the lint-strict check
        assert "py:format" in result.stdout
        assert "py:lint-strict" in result.stdout
```

**Step 2: Run integration tests**

Run: `cd py && uv run pytest tests/test_integration.py -v`
Expected: All passed

**Step 3: Run full test suite**

Run: `cd py && uv run pytest -v`
Expected: All passed

**Step 4: Commit**

```bash
git add py/tests/test_integration.py
git commit -m "test: add integration tests for check strict and lint-strict"
```

---

### Task 5: Update documentation

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/tools.md`

**Step 1: Update docs/README.md**

Add `check strict` to the Commands table:

```markdown
| `check strict` | full + strict lint (wemake-python-styleguide) | Opt-in stricter checks |
```

Add `lint-strict` to the individual check names where they are listed.

**Step 2: Update docs/tools.md**

Add a section for wemake-python-styleguide under the Python tools:

```markdown
### wemake-python-styleguide (py:lint-strict)

The strictest Python linter. Runs as a flake8 plugin with `--select=WPS` to complement ruff.
Only runs as part of `check strict` or individually via `check lint-strict`.

- **Tool:** [wemake-python-styleguide](https://github.com/wemake-services/wemake-python-styleguide)
- **Runner:** flake8
- **Config:** All via CLI flags (no config file needed in target project)
```

**Step 3: Verify no stale references**

Run: `grep -rn "check strict\|lint-strict\|wemake" docs/`
Expected: Only the new additions

**Step 4: Commit**

```bash
git add docs/README.md docs/tools.md
git commit -m "docs: add check strict and py:lint-strict documentation"
```
