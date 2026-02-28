# Pied Piper: Pivot from Docker to uvx/npx Distribution

**Date:** 2026-02-28
**Status:** Approved

## Context

Pied Piper is a guardrails orchestrator for agentic coding workflows (Claude Code).
The current architecture uses Docker to package 13 linting/formatting tools with a
security sandbox (network isolation, read-only FS, secret stripping). A Justfile
orchestrates checks in both native and Docker modes.

After review, Docker + Just introduces unnecessary install friction and complexity
for what the tool actually does — run linters. The security sandbox solves a problem
that barely exists for read-only code analysis tools.

## Decision

Pivot to two independently distributable CLI tools:

- **`pied-piper` on PyPI** — wraps all Python code quality tools
- **`pied-piper` on npm** — wraps all TypeScript/JS code quality tools

Each is self-contained, installed via `uvx pied-piper` / `npx pied-piper`, and
eliminates the Docker, Just, and shell script infrastructure.

Both packages also expose a `piper` alias for users who permanently install.

## Architecture

### Repo Structure (monorepo)

```
pied-piper/
├── py/                            # PyPI package: "pied-piper"
│   ├── pyproject.toml
│   └── src/piper_py/
│       ├── __init__.py
│       ├── cli.py                 # Entry point (argparse)
│       ├── runner.py              # Subprocess execution + output normalization
│       └── checks.py              # Check definitions (name, command, skip condition)
├── ts/                            # npm package: "pied-piper"
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── cli.ts                 # Entry point
│       ├── runner.ts              # Subprocess execution + output normalization
│       └── checks.ts              # Check definitions
├── docs/
└── README.md
```

### CLI Interface

Both tools share the same command structure:

```
pied-piper <command> [files...]
```

| Command      | Checks                                          | Hook target   |
| ------------ | ----------------------------------------------- | ------------- |
| `check-fast` | format + lint + type                            | PostToolUse   |
| `check-full` | fast + arch + deadcode + security/complexity    | Stop          |
| `fix`        | auto-fix format + lint                          | manual        |
| `version`    | print version                                   |               |

### Python Checks (pied-piper on PyPI)

| Tier | Check          | Tool           | Skip condition                                |
| ---- | -------------- | -------------- | --------------------------------------------- |
| fast | `py:format`    | ruff format    | no .py files                                  |
| fast | `py:lint`      | ruff check     | no .py files                                  |
| fast | `py:type`      | ty check       | no .py files                                  |
| full | `py:arch`      | lint-imports   | no `[tool.importlinter]` in pyproject.toml    |
| full | `py:deadcode`  | vulture        | no .py files                                  |
| full | `py:security`  | bandit         | no .py files                                  |
| full | `py:complexity`| xenon          | no .py files                                  |
| full | `py:semgrep`   | semgrep scan   | no .semgrep.yml                               |

Dependencies: ruff, ty, import-linter, vulture, bandit, xenon, semgrep

### TypeScript Checks (pied-piper on npm)

| Tier | Check          | Tool              | Skip condition                           |
| ---- | -------------- | ----------------- | ---------------------------------------- |
| fast | `ts:format`    | biome format      | no .ts/.tsx/.js/.jsx files               |
| fast | `ts:lint`      | biome lint        | no .ts/.tsx/.js/.jsx files               |
| fast | `ts:type`      | tsc --noEmit      | no .ts files                             |
| full | `ts:arch`      | depcruise         | no .dependency-cruiser.js or no src/     |
| full | `ts:deadcode`  | knip              | no .ts files in src/                     |
| full | `ts:typecov`   | type-coverage     | no .ts files in src/                     |
| full | `ts:astgrep`   | ast-grep scan     | no sgconfig.yml                          |

Dependencies: @biomejs/biome, typescript, dependency-cruiser, knip, type-coverage, @ast-grep/cli

### Output Format

```
OK   py:format
OK   py:lint
FAIL py:type
COMMAND ty check .
  error[invalid-type] ...
```

- All checks in a tier run regardless of individual failures
- Exit 0 if all pass, exit 2 if any fail (Claude Code hook convention)
- `SKIP <check> (reason)` when a check is not applicable

### Config Strategy

Respect project config when it exists. Ship sensible defaults for when it doesn't.
Never force our config over the user's.

Defaults are hardcoded in check definitions (not shipped as config files).

Standard exclude patterns (both tools): `.venv`, `.devenv`, `.direnv`, `node_modules`,
`dist`, `build`, `.next`, `__pycache__`, `.git`, `tests`, `test`, `__tests__`

### Hook Configuration

```json
{
  "hooks": {
    "PostToolUse": [{ "matcher": "Edit|Write", "hooks": [
      { "type": "command", "command": "uvx pied-piper check-fast" },
      { "type": "command", "command": "npx pied-piper check-fast" }
    ]}],
    "Stop": [{ "hooks": [
      { "type": "command", "command": "uvx pied-piper check-full" },
      { "type": "command", "command": "npx pied-piper check-full" }
    ]}]
  }
}
```

Users add only the hooks for languages they use.

### Naming

| Registry | Package name   | Binary names            | Usage                         |
| -------- | -------------- | ----------------------- | ----------------------------- |
| PyPI     | `pied-piper`   | `pied-piper`, `piper`   | `uvx pied-piper check-fast`  |
| npm      | `pied-piper`   | `pied-piper`, `piper`   | `npx pied-piper check-fast`  |

`piper` alias is available after permanent install (`uv tool install` / `npm install -g`).

## What Gets Deleted

- `Dockerfile` — Docker packaging
- `docker/` — entrypoint, docker-specific pyproject.toml
- `bin/pied-piper` — Docker wrapper script
- `install.sh` — Docker-based installer
- `Justfile` — orchestration moves into CLI tools
- `scripts/run-check.sh` — output normalization reimplemented in each tool
- `.github/workflows/docker-publish.yml` — replaced with PyPI/npm publish workflows

## What Transfers

- Two-tier checking concept (fast / full) — core value, unchanged
- Output normalization (OK/FAIL format) — reimplemented in Python/TS
- Hook integration with Claude Code — different commands, same mechanism
- Same underlying tools (ruff, biome, etc.)
- Same check categories and skip logic
- File detection heuristics

## Design Principles

- **Subprocess-based**: each check calls its tool via subprocess. CLI is the stable contract.
- **stdlib CLI parsing**: argparse (Python), minimal parsing (TS). No extra deps for CLI.
- **Flat modules**: single `checks.py`/`checks.ts` defines all checks. No over-engineered directory-per-check.
- **No tool binary is expected on PATH**: tools are package dependencies, always available in the install environment.
