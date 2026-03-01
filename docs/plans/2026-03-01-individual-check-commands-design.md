# Individual Check Commands for Python CLI

**Date:** 2026-03-01
**Status:** Approved

## Problem

When the LLM is fixing issues found by `check fast` or `check full`, it needs to re-run just the failing check to verify the fix. Running the entire suite is slow and produces noisy output. There is no way to run a single check.

## Design

### Command surface

Unify all check commands under a single `check` subcommand:

```
pied-piper check fast          # format + lint + type (replaces check-fast)
pied-piper check full          # all checks (replaces check-full)
pied-piper check format        # individual checks
pied-piper check lint
pied-piper check type
pied-piper check arch
pied-piper check deadcode
pied-piper check security
pied-piper check complexity
pied-piper check semgrep
pied-piper fix                 # unchanged
pied-piper version             # unchanged
```

The old `check-fast` and `check-full` top-level commands are removed (clean break, v0.1).

### Check name resolution

The `check` subcommand accepts a single required positional argument. Resolution order:

1. `fast` -> run `FAST_CHECKS`
2. `full` -> run `FULL_CHECKS`
3. Look up name in `ALL_CHECKS_BY_NAME` dict -> run that single check
4. Not found -> print error with available names, exit 1

`ALL_CHECKS_BY_NAME` is a dict mapping short names (e.g. `format`, `type`) to `Check` objects, built from `FULL_CHECKS` by stripping the `py:` prefix.

### Changes by file

**`checks.py`** — Add lookup dict:
```python
ALL_CHECKS_BY_NAME: dict[str, Check] = {
    c.name.removeprefix("py:"): c for c in FULL_CHECKS
}
```

**`cli.py`** — Restructure from flat `choices=` to argparse subparsers:
- `check` subcommand with required `name` argument
- `fix` subcommand (unchanged logic)
- `version` subcommand (unchanged logic)
- Bare `check` with no name prints error listing available names

**`runner.py`** — No changes. `run_check()` already handles individual checks.

### Output format

Unchanged. Single check produces one line on success:
```
OK   py:format
```

Or on failure:
```
FAIL py:type
COMMAND ty check ...
  error output...
```

### Exit codes

Unchanged: `0` = pass, `2` = fail.

### Hook configuration update

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "uvx pied-piper check fast" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "uvx pied-piper check full" }
        ]
      }
    ]
  }
}
```

### Tests

- `check <name>` runs the correct individual check
- `check fast` runs fast checks
- `check full` runs all checks
- `check <invalid>` produces error with available names
- `check` with no name produces error with available names
- `fix` and `version` still work
