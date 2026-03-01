# Design: Add wemake-python-styleguide as `py:lint-strict`

**Date:** 2026-03-01
**Status:** Approved

## Problem

Ruff catches standard linting issues, but teams wanting stricter Python style enforcement have no opt-in path. [wemake-python-styleguide](https://github.com/wemake-services/wemake-python-styleguide) is the strictest Python linter available and is explicitly designed to complement ruff.

## Solution

Add a new check `py:lint-strict` that runs wemake-python-styleguide via flake8, and a new group command `check strict` that includes everything in `check full` plus this new check.

## Architecture

New tier following the existing pattern:

```
FAST_CHECKS:          format, lint, type
FULL_ONLY_CHECKS:     arch, deadcode, security, complexity, semgrep
STRICT_ONLY_CHECKS:   lint-strict        <-- new
FULL_CHECKS  = FAST + FULL_ONLY
STRICT_CHECKS = FULL + STRICT_ONLY       <-- new
```

### Check definition

- **Name:** `py:lint-strict`
- **Command:** `flake8 . --select=WPS` with standard directory exclusions
- **Skip condition:** `_no_py()` (same as other Python checks)
- **Config:** All configuration via CLI flags (no config file needed in target project)

### Dependencies

Add to `pyproject.toml`:
- `flake8`
- `wemake-python-styleguide`

### CLI changes

- `check strict` runs `STRICT_CHECKS` (= `FULL_CHECKS` + `STRICT_ONLY_CHECKS`)
- `check lint-strict` runs the individual check
- `ALL_CHECKS_BY_NAME` includes checks from both `FULL_CHECKS` and `STRICT_ONLY_CHECKS`
- Help/error messages list `fast, full, strict` as group options

### Hook usage

CLI command only. No changes to default hook behavior (fast on edit, full on stop). Users can wire `check strict` into hooks themselves if desired.

## Testing

- **`test_checks.py`:** Verify `STRICT_ONLY_CHECKS` and `STRICT_CHECKS` lists, `lint-strict` in `ALL_CHECKS_BY_NAME`
- **`test_cli.py`:** Verify `check strict` routing, error messages include `strict`
- **`test_integration.py`:** Run `pied-piper check lint-strict` against a Python file, verify output format

No changes to `runner.py` or `detect.py`.
