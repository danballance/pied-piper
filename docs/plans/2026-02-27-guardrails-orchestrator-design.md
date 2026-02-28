> **Status: IMPLEMENTED** (2026-02-27)

# Pied Piper: Guardrails Orchestrator for Agentic Coding

## Overview

Pied Piper is a guardrails orchestrator that wires deterministic checks (linting, type checking, architecture enforcement, security scanning, and more) into agentic coding workflows. It starts as a practical Justfile-based setup in this project, with the intent to extract into a reusable tool once we've discovered what works.

**Target agent:** Claude Code (hooks system)
**Target languages:** Python + TypeScript
**Orchestration layer:** Just (justfile)

## Tool Inventory

### Python-specific

| Tool | Recipe | Purpose | Speed |
|------|--------|---------|-------|
| ruff format | `py-format` | Code formatting | <1s |
| ruff check --fix | `py-lint` | Linting (900+ rules) | <1s |
| ty check | `py-type` | Type checking | seconds |
| import-linter | `py-arch` | Architecture boundary enforcement | seconds |
| vulture | `py-deadcode` | Dead code detection | seconds |
| bandit | `py-security` | Security scanning (SAST) | seconds |
| pip-audit | `py-audit` | Dependency vulnerability scanning | seconds |
| xenon | `py-complexity` | Complexity gates (wraps radon) | seconds |
| hypothesis | `py-proptest` | Property-based testing (pytest -m hypothesis) | minutes |
| mutmut | `py-mutate` | Mutation testing | batch |

### TypeScript-specific

| Tool | Recipe | Purpose | Speed |
|------|--------|---------|-------|
| biome format | `ts-format` | Code formatting | <1s |
| biome lint | `ts-lint` | Linting | <1s |
| tsc --noEmit | `ts-type` | Type checking | seconds |
| dependency-cruiser | `ts-arch` | Architecture boundary enforcement | seconds |
| knip | `ts-deadcode` | Dead code / unused exports | seconds |
| type-coverage | `ts-typecov` | Type coverage enforcement | seconds |

### Cross-language

| Tool | Recipe | Purpose | Speed |
|------|--------|---------|-------|
| semgrep | `x-semgrep` | Custom structural rules + security | seconds |
| ast-grep | `x-astgrep` | Structural search/lint | seconds |

## Justfile Structure

### Individual tool recipes

Each tool gets its own recipe (`just py-format`, `just ts-lint`, etc.) for granular control.

### Composite recipes (progressive ordering)

```
check-fast    = format -> lint -> type check (all languages, <5s)
check-arch    = check-fast + architecture + dead code + security
check-all     = check-arch + property tests + schema validation
check-mutate  = mutation testing (run separately, slow)
```

### Hook-targeted recipes

```
check-edit    = check-fast    (runs after every file edit)
check-stop    = check-arch    (runs before Claude finishes a task)
check-pr      = check-all     (runs for PR validation)
```

### Utility recipes

```
tools-install = install all guardrail tools via uv/npm
tools-status  = check which tools are installed and their versions
```

## Claude Code Hooks Integration

Hooks configured in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "command": "just check-edit"
      }
    ],
    "Stop": [
      {
        "command": "just check-stop"
      }
    ]
  }
}
```

- **PostToolUse (Edit|Write):** Runs `just check-edit` after every file edit. Fast checks only.
- **Stop:** Runs `just check-stop` before Claude finishes a task. Full arch/deadcode/security suite.
- Exit code 2 blocks and feeds errors back to Claude for self-correction.

## Tool Installation & Dependencies

### Python tools (uv dev dependencies)

Added to `pyproject.toml` under `[dependency-groups] dev`:
ruff, ty, import-linter, vulture, bandit, pip-audit, xenon, hypothesis, mutmut, semgrep

### TypeScript tools (npm dev dependencies)

Added to `package.json` under `devDependencies`:
@biomejs/biome, typescript, dependency-cruiser, knip, type-coverage, @ast-grep/cli

### Dev environment

`just` added to `devenv.nix` as a package. Everything is project-local (uv venv + node_modules), no global installs.

## Configuration Files

### Python (in pyproject.toml where possible)

- `ruff` -- `[tool.ruff]` section
- `ty` -- `[tool.ty]` section
- `import-linter` -- `[tool.importlinter]` with layer contracts
- `vulture` -- CLI flags in Just recipe + `vulture_whitelist.py` for false positives
- `bandit` -- CLI flags (skip low-confidence)
- `xenon` -- CLI flags (`--max-absolute B --max-modules A`)

### TypeScript (project root)

- `biome.json`
- `tsconfig.json`
- `.dependency-cruiser.js`
- `knip.json`

### Cross-language (project root)

- `.semgrep.yml` -- custom rules + registry rulesets
- `sgconfig.yml` -- ast-grep config

## Error Output Format

### On success

Each tool prints one line:
```
OK ruff format
OK ruff check
OK ty
```

### On failure

Tool name + error summary only (no verbose output):
```
FAIL ruff check
  pied_piper/main.py:14:5 F841 Local variable `x` is assigned but never used
  Found 1 error (0 fixed)
```

### Exit codes

- `0` -- all checks pass
- `2` -- checks failed (Claude Code interprets as "block and feed back")

### Diff-only mode

For `check-edit`, check only the changed file when the path is available via environment variables. Fall back to checking everything otherwise.

## Design Principles

1. **Experiment first, extract later** -- this is a discovery phase; the Justfile is the laboratory
2. **Progressive checking** -- fast checks first, slow checks later; never block on minutes-long checks during editing
3. **Token-efficient output** -- concise errors for the agent, verbose output available for humans via individual recipes
4. **Cast a wide net, then narrow** -- try all tools, remove the ones that are too noisy or low-value
5. **YAGNI** -- no abstraction layers, no plugin systems, just recipes calling tools
