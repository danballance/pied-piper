# Pied Piper

A guardrails orchestrator for agentic coding workflows (Claude Code). Two CLI tools -- one Python, one TypeScript -- that run code quality checks and provide structured feedback via Claude Code hooks.

Each tool bundles its own language ecosystem's checks. Add hooks only for the languages you use.

## Quick Start

No install required. Run directly with `uvx` or `npx`:

```bash
# Python checks
uvx pied-piper check-fast

# TypeScript checks
npx pied-piper check-fast
```

## Hook Configuration

Add to `.claude/settings.json` (or `.claude/settings.local.json`). Include only the hooks for languages you use:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "uvx pied-piper check-fast" },
          { "type": "command", "command": "npx pied-piper check-fast" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "uvx pied-piper check-full" },
          { "type": "command", "command": "npx pied-piper check-full" }
        ]
      }
    ]
  }
}
```

How it works:

1. Claude edits a file via `Edit` or `Write`
2. `PostToolUse` runs `check-fast` (format + lint + type) -- fast feedback in seconds
3. If checks fail (exit 2), Claude sees the error output and self-corrects
4. When Claude is about to stop, the `Stop` hook runs `check-full` (the complete suite)
5. If the full suite fails, Claude continues fixing instead of stopping

## Commands

| Command | What it runs | When to use |
|---------|-------------|-------------|
| `check-fast` | format + lint + type check | Every edit (PostToolUse) |
| `check-full` | fast + arch + deadcode + security/complexity | Before agent stops (Stop hook) |
| `fix` | Auto-fix formatting and lint | Manual cleanup |
| `version` | Print version | Troubleshooting |

## Python Checks

Run via: `uvx pied-piper <command>`

| Check | Tool | Tier | Skip when |
|-------|------|------|-----------|
| `py:format` | ruff format | fast | No `.py` files |
| `py:lint` | ruff check | fast | No `.py` files |
| `py:type` | ty | fast | No `.py` files |
| `py:arch` | import-linter | full | No `[tool.importlinter]` in pyproject.toml |
| `py:deadcode` | vulture | full | No `.py` files |
| `py:security` | bandit | full | No `.py` files |
| `py:complexity` | xenon | full | No `.py` files |
| `py:semgrep` | semgrep | full | No `.semgrep.yml` with rules |

`fix` runs: `ruff format .` then `ruff check --fix .`

## TypeScript Checks

Run via: `npx pied-piper <command>`

| Check | Tool | Tier | Skip when |
|-------|------|------|-----------|
| `ts:format` | biome format | fast | No `.ts`/`.js` files |
| `ts:lint` | biome lint | fast | No `.ts`/`.js` files |
| `ts:type` | tsc | fast | No `.ts` files |
| `ts:arch` | dependency-cruiser | full | No `.dependency-cruiser.js` |
| `ts:deadcode` | knip | full | No `.ts` files in `src/` |
| `ts:typecov` | type-coverage | full | No `.ts` files in `src/` |
| `ts:astgrep` | ast-grep | full | No `sgconfig.yml` |

`fix` runs: `biome format --write .` then `biome lint --write .`

## Output Format

Every check prints a single status line:

```
OK   py:format
OK   py:lint
FAIL py:type
COMMAND ty check --exclude .venv/ ...
  src/main.py:14:5 - Type 'str' not assignable to 'int'
SKIP ts:format (not applicable)
```

Exit codes:

- `0` -- all checks passed
- `2` -- one or more checks failed (Claude Code convention: block and feed back)

## Permanent Install

For a persistent install with the shorter `piper` alias:

```bash
# Python
uv tool install pied-piper    # provides: pied-piper, piper

# TypeScript
npm install -g pied-piper      # provides: pied-piper, piper
```

---

See [tools.md](tools.md) for detailed information on each underlying tool, configuration options, and tuning.
