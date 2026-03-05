# Pied Piper

A guardrails orchestrator for agentic coding workflows (Claude Code). Two CLI tools -- one Python, one TypeScript -- that run code quality checks and provide structured feedback via Claude Code hooks.

Each tool bundles its own language ecosystem's checks. Add hooks only for the languages you use.

## Quick Start

No install required. Run directly with `uvx` or `npx`:

```bash
# Python checks
uvx piper-py check fast

# TypeScript checks
npx piper-ts check fast
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

## Commands

| Command | What it runs | When to use |
|---------|-------------|-------------|
| `check fast` | format + lint + type check | Every edit (PostToolUse) |
| `check full` | fast + arch + deadcode + security/complexity | Before agent stops (Stop hook) |
| `check strict` | full + strict lint (wemake-python-styleguide) | Opt-in stricter checks |
| `check <name>` | A single check (e.g. `format`, `type`, `security`) | Re-run one failing check |
| `format` | Auto-fix formatting | Manual cleanup |
| `fix` | Auto-fix lint issues | Manual cleanup |
| `version` | Print version | Troubleshooting |

## Python Checks

Run via: `uvx piper-py <command>`

| Check | Tool | Tier | Skip when |
|-------|------|------|-----------|
| `py:format` | ruff format | fast | No `.py` files |
| `py:lint` | ruff check | fast | No `.py` files |
| `py:type` | ty | fast | No `.py` files |
| `py:arch` | import-linter | full | No `[tool.importlinter]` in pyproject.toml |
| `py:deadcode` | vulture | full | No `.py` files |
| `py:security` | bandit | full | No `.py` files |
| `py:complexity` | complexipy | full | No `.py` files |
| `py:semgrep` | semgrep | full | No `semgrep` on PATH or no `.semgrep.yml` with rules |
| `py:lint-strict` | wemake-python-styleguide (via flake8) | strict | No `.py` files |

`format` runs: `ruff format .`
`fix` runs: `ruff check --fix .`

## TypeScript Checks

Run via: `npx piper-ts <command>`

| Check | Tool | Tier | Skip when |
|-------|------|------|-----------|
| `ts:format` | biome format | fast | No `.ts`/`.js` files |
| `ts:lint` | biome lint | fast | No `.ts`/`.js` files |
| `ts:type` | tsc | fast | No `.ts` files |
| `ts:arch` | dependency-cruiser | full | No `.dependency-cruiser.js` |
| `ts:deadcode` | knip | full | No `.ts` files in `src/` |
| `ts:typecov` | type-coverage | full | No `.ts` files in `src/` |
| `ts:astgrep` | ast-grep | full | No `sgconfig.yml` |

`format` runs: `biome format --write .`
`fix` runs: `biome lint --write .`

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

```bash
# Python
uv tool install piper-py    # provides: piper-py

# TypeScript
npm install -g piper-ts      # provides: piper-ts
```

---

See [tools.md](tools.md) for detailed information on each underlying tool, configuration options, and tuning.
