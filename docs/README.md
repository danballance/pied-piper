# Pied Piper

A guardrails orchestrator for agentic coding workflows (Claude Code). Two CLI tools -- one Python, one TypeScript -- that run code quality checks and tests, providing structured feedback via Claude Code hooks.

Each tool bundles its own language ecosystem's checks. Add hooks only for the languages you use.

## Quick Start

```bash
# 1. Generate config
uvx piper-py init        # creates .piper/piper.toml with Python defaults
npx piper-ts init        # creates .piper/piper.toml with TypeScript defaults

# 2. Run checks
uvx piper-py check fast
npx piper-ts check fast

# 3. Run tests
uvx piper-py test unit
npx piper-ts test unit
```

## Configuration

All checks, tests, and fix commands are defined in `.piper/piper.toml`. Run `init` to generate a starter config with inline comments, then edit to match your project.

```bash
uvx piper-py init    # generates .piper/piper.toml with Python defaults
npx piper-ts init    # generates .piper/piper.toml with TypeScript defaults
```

Every entry is a literal shell command, run as-is. Remove lines to disable checks, change command strings to swap tools, add new lines to add checks.

### Config format

The config has four top-level sections: `[check]`, `[test]`, `[format]`, and `[fix]`.

**check and test** use tiered sub-tables:

```toml
[check]
tiers = { fast = ["fast"], full = ["fast", "full"] }

[check.fast]
format = "ruff format --check ."
lint = "ruff check ."

[check.full]
arch = "lint-imports --no-cache"
```

The `tiers` line defines what each tier includes. `fast = ["fast"]` means `check fast` runs only `[check.fast]`. `full = ["fast", "full"]` means `check full` runs both `[check.fast]` and `[check.full]` — tiers are cumulative.

Individual commands can be run by name: `check format` finds `format` in `[check.fast]` and runs just that one command.

Test tiers work identically. Note that `e2e = ["e2e"]` maps only to `[test.e2e]` — it is standalone, not cumulative with the other tiers:

```toml
[test]
tiers = { unit = ["unit"], full = ["unit", "full"], e2e = ["e2e"] }
```

**format and fix** are flat — no tiers, all commands run together:

```toml
[format]
py = "ruff format ."

[fix]
lint = "ruff check --fix ."
```

### Customization

- **Change a tool**: replace the command string (e.g., `type = "mypy ."`)
- **Disable a check**: delete the line
- **Add a check**: add a new `name = "command"` line in the appropriate sub-table
- **Change tier composition**: edit the `tiers` mapping (e.g., add a new tier name)

The generated config includes standard `--exclude` flags for common directories (`.venv`, `node_modules`, `dist`, etc.). Adjust these to match your project layout.

## Commands

| Command | What it runs | When to use |
|---------|-------------|-------------|
| `init` | Generate `.piper/piper.toml` | Project setup (once) |
| `check fast` | format + lint + type check | Every edit (PostToolUse hook) |
| `check full` | fast + arch + deadcode + security/complexity | Before agent stops (Stop hook) |
| `check strict` | full + strict lint | Opt-in stricter checks |
| `check <name>` | A single check (e.g. `format`, `type`, `security`) | Re-run one failing check |
| `test unit` | Unit tests | Quick feedback |
| `test full` | unit + integration/contract tests | Before agent stops |
| `test e2e` | End-to-end tests | Full validation |
| `test <name>` | A single test (e.g. `unit`, `contract`) | Re-run one failing test |
| `format` | Auto-fix formatting | Manual cleanup |
| `fix` | Auto-fix lint issues | Manual cleanup |
| `version` | Print version | Troubleshooting |

## Hook Configuration

Add to `.claude/settings.json` (or `.claude/settings.local.json`). Include only the hooks for languages you use:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "uvx piper-py check fast" },
          { "type": "command", "command": "npx piper-ts check fast" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "uvx piper-py check full" },
          { "type": "command", "command": "npx piper-ts check full" }
        ]
      }
    ]
  }
}
```

How it works:

1. Claude edits a file via `Edit` or `Write`
2. `PostToolUse` runs `check fast` (format + lint + type) -- fast feedback in seconds
3. If checks fail (exit 2), Claude sees the error output and self-corrects
4. When Claude is about to stop, the `Stop` hook runs `check full` (the complete suite)
5. If the full suite fails, Claude continues fixing instead of stopping

**Prerequisites:** Run `piper-py init` / `piper-ts init` first to generate `.piper/piper.toml`.

## Monorepo Usage

Use `--directory` / `-d` to target a subdirectory. Each subdirectory should have its own `.piper/piper.toml`:

```bash
# Initialize each subdirectory
uvx piper-py -d ./api init
npx piper-ts -d ./ui init

# Check
uvx piper-py -d ./api check fast
npx piper-ts -d ./ui check fast
```

Hook configuration for monorepos:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "uvx piper-py -d ./api check fast" },
          { "type": "command", "command": "npx piper-ts -d ./ui check fast" }
        ]
      }
    ]
  }
}
```

## Output Format

Every check prints a single status line:

```
OK   format
OK   lint
FAIL type
COMMAND ty check
  src/main.py:14:5 - Type 'str' not assignable to 'int'
```

Exit codes:

- `0` -- all checks passed
- `2` -- one or more checks failed (Claude Code convention: block and feed back)

## Permanent Install

```bash
# Python
uv tool install piper-py    # provides: piper-py

# TypeScript
npm install -g piper-ts      # provides: piper-ts
```

---

See [tools.md](tools.md) for detailed information on each underlying tool, configuration options, and tuning.
