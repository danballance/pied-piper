# Pied Piper Guardrails Orchestrator

Pied Piper wires deterministic checks (formatting, linting, type checking, architecture enforcement, security scanning, dead code detection, and more) into agentic coding workflows with Claude Code. It ships as a Docker image that packages all 13 tools into a single command — no venvs, no config files, no tool installation required. A single shared Justfile drives both Docker and native workflows.

## Quick Start (Docker)

Prerequisites: Docker installed and running.

```bash
# Install the wrapper script (puts `pied-piper` on your PATH)
curl -sSL https://raw.githubusercontent.com/danballance/pied-piper/main/install.sh | sh

# Run fast checks (format + lint + type check)
pied-piper check-fast

# Run the full suite (+ security, dead code, complexity)
pied-piper check-full

# Auto-fix formatting and lint issues
pied-piper fix
```

That's it. No config files, no virtual environments, no tool installation.

## Quick Start (Native / Development)

```bash
# Enter the dev environment (provides just, python, node, uv, npm)
devenv shell

# Install all guardrail tool dependencies
just tools-install

# Verify all tools are available
just tools-status

# Run fast checks (format + lint + type)
just check-fast

# Run the full architecture suite
just check-stop

# See all available recipes
just --list
```

## Docker CLI Reference

| Command | What it runs | Speed |
|---------|-------------|-------|
| `pied-piper check-fast` | format + lint + type check (all languages) | ~5s |
| `pied-piper check-full` | check-fast + architecture + security + dead code + complexity + semgrep + ast-grep | ~15s |
| `pied-piper check-pr` | Full check suite | ~15s |
| `pied-piper fix` | Auto-fix formatting and lint issues | ~5s |
| `pied-piper version` | Print version | instant |

### Output Format

Both Docker and native workflows use the same category-based output format:

```
OK   py:format
OK   py:lint
FAIL py:typecheck
  pied_piper/main.py:14:5 - Type 'str' not assignable to 'int'
SKIP ts:format (no JS/TS source files found)
```

Exit codes: `0` = all pass, `2` = check failed (Claude Code convention for "block and feed back").

### Security Model

The wrapper script runs Docker with a strict security posture:

- `--network none` — no internet access, no data exfiltration
- `--read-only` — container filesystem is immutable
- `--cap-drop ALL` — no Linux capabilities
- `--security-opt no-new-privileges` — no privilege escalation
- Source code mounted read-only (except during `fix`)
- Sensitive environment variables stripped inside the container

### Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `PIED_PIPER_IMAGE` | `ghcr.io/your-org/pied-piper:latest` | Override Docker image |
| `PIED_PIPER_INSTALL_DIR` | `/usr/local/bin` | Override install location |

The wrapper auto-mounts `.venv` and `node_modules` when they exist in the project directory, improving accuracy for type checkers and architecture tools.

### Known Limitations (Docker)

- **~1-3s startup overhead** per invocation (Docker container startup)
- **macOS** — Docker bind mount I/O is 2-5x slower than native

## Recipe Reference

### Python-Specific

| Recipe | Tool | What it does |
|--------|------|-------------|
| `just py-format` | ruff format | Check Python formatting (fails if unformatted) |
| `just py-format-fix` | ruff format | Fix Python formatting in place |
| `just py-lint` | ruff check | Lint Python code (900+ rules) |
| `just py-lint-fix` | ruff check | Auto-fix Python lint issues |
| `just py-type` | ty | Type check Python code |
| `just py-arch` | import-linter | Enforce architectural boundaries between modules |
| `just py-deadcode` | vulture | Detect unused functions, classes, variables |
| `just py-security` | bandit | Security scan (SAST) for common vulnerabilities |
| `just py-complexity` | xenon | Enforce code complexity thresholds |

Python format/lint recipes accept an optional `FILES` argument (default: `.`):
```bash
just py-lint src/
```

### TypeScript-Specific

| Recipe | Tool | What it does |
|--------|------|-------------|
| `just ts-format` | biome format | Check TypeScript/JS formatting |
| `just ts-format-fix` | biome format | Fix formatting in place |
| `just ts-lint` | biome lint | Lint TypeScript/JS code |
| `just ts-lint-fix` | biome lint | Auto-fix lint issues |
| `just ts-type` | tsc | Type check TypeScript (skips if no .ts files) |
| `just ts-arch` | dependency-cruiser | Enforce TS module boundaries (skips if no config) |
| `just ts-deadcode` | knip | Find unused exports/files (skips if no .ts files) |
| `just ts-typecov` | type-coverage | Enforce type coverage threshold (skips if no .ts files) |

TypeScript recipes gracefully skip with a `SKIP` message when no `.ts` source files exist in `src/`.

### Cross-Language

| Recipe | Tool | What it does |
|--------|------|-------------|
| `just x-semgrep` | semgrep | Run custom structural rules + security patterns |
| `just x-astgrep` | ast-grep | Run structural code checks via tree-sitter |

### Composite Recipes

These run tools in progressive order (fast to slow):

| Recipe | Includes | Speed |
|--------|----------|-------|
| `just check-fast` | format + lint + type (all languages) | <5s |
| `just check-full` | check-fast + architecture + dead code + security + complexity + semgrep + ast-grep | ~15s |

### Hook-Targeted Recipes

These are aliases for composite recipes, named for the Claude Code hook event that triggers them:

| Recipe | Alias for | Triggered by |
|--------|-----------|-------------|
| `just check-edit` | check-fast | PostToolUse (after Edit/Write) |
| `just check-stop` | check-full | Stop (before Claude finishes) |
| `just check-pr` | check-full | Manual / CI |

### Utility Recipes

| Recipe | What it does |
|--------|-------------|
| `just tools-install` | Run `uv sync` and `npm install` |
| `just tools-status` | Print installed/missing status for all 13 tools |

## Progressive Checking

The guardrails are organized into two tiers so fast checks run frequently and the full suite runs less often:

```
check-edit (every file edit)
  └── check-fast: format → lint → type check

check-stop / check-pr (before Claude finishes / PR validation)
  └── check-full: check-fast + architecture + dead code + security + complexity + semgrep + ast-grep
```

This ensures the agent gets immediate feedback on formatting/lint/type errors (<5s) without being blocked by slower checks until it's done working.

## Claude Code Hooks

Hooks are configured in `.claude/settings.local.json`. Choose the configuration matching your workflow:

### Docker workflow

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "pied-piper check-fast" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "pied-piper check-full" }]
      }
    ]
  }
}
```

### Native workflow

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "just check-edit" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "just check-stop" }]
      }
    ]
  }
}
```

**How it works:**

1. Claude edits a file via the `Edit` or `Write` tool
2. The `PostToolUse` hook runs `just check-edit` (format + lint + type)
3. If checks pass (exit 0), Claude continues normally
4. If checks fail (exit 2), Claude sees the error output and self-corrects before proceeding
5. When Claude is about to finish, the `Stop` hook runs `just check-stop` (full suite)
6. If the full suite fails, Claude continues fixing instead of stopping

### Output Format

Both Docker and native workflows share the same Justfile and produce identical output. The `scripts/run-check.sh` helper normalizes output across all tools:

```
# On success:
OK   py:format
OK   py:lint
OK   py:typecheck

# On failure:
FAIL py:lint
  pied_piper/main.py:14:5 F841 Local variable `x` is assigned but never used
  Found 1 error (0 fixed)
```

Exit codes: `0` = pass, `2` = fail (Claude Code convention for "block and feed back").

## Configuration

### Python tools (in `pyproject.toml`)

| Tool | Config section | Key settings |
|------|---------------|-------------|
| ruff | `[tool.ruff]` | line-length=88, target-version="py312", extend-exclude for test files |
| ruff lint rules | `[tool.ruff.lint]` | Broad rule selection (E, F, W, I, N, UP, S, B, etc.) |
| import-linter | `[tool.importlinter]` | Not yet configured — add root_packages and contracts per-project |
| vulture | CLI flags in Justfile | `--min-confidence 80` |
| bandit | CLI flags in Justfile | `-q -ll` (quiet, medium+ severity) |
| xenon | CLI flags in Justfile | `--max-absolute B --max-modules A --max-average A` |

### TypeScript tools (project root)

| Tool | Config file | Key settings |
|------|------------|-------------|
| biome | `biome.json` | recommended rules, space indent, files.includes whitelist |
| tsc | `tsconfig.json` | ES2022, Node16, strict, noEmit |
| dependency-cruiser | `.dependency-cruiser.js` | Not yet created (recipe skips gracefully) |

### Cross-language tools (project root)

| Tool | Config file | Key settings |
|------|------------|-------------|
| semgrep | `.semgrep.yml` | Custom rules: no-eval, no-hardcoded-secrets |
| ast-grep | `sgconfig.yml` | Points to `rules/` directory |

### Test File Exclusions

All tools are configured to skip common test file patterns by default:

- **Python:** `tests/`, `test/`, `test_*.py`, `*_test.py`, `conftest.py`
- **TypeScript:** `__tests__/`, `*.test.ts`, `*.spec.ts`, `*.test.js`, `*.spec.js`, `tests/`, `test/`

Exclusions are set via config files where supported (`pyproject.toml`, `biome.json`, `tsconfig.json`, `.semgrep.yml`) and via CLI flags in the Justfile for tools that don't support config-based exclusions.

## Adding a New Tool

1. **Install it** — add to `pyproject.toml` dev deps (Python) or `package.json` devDependencies (TypeScript)
2. **Create the recipe** — add a `just` recipe in the appropriate group, wrapping the command with `{{run_check}}`
3. **Wire into composites** — add the recipe name to `check-fast` or `check-full` depending on speed
4. **Add config** — create any needed config files, or add a section to `pyproject.toml`
5. **Test** — run the recipe individually, then run the composite it belongs to

Example — adding a new Python tool called `mynewtool`:

```just
# Check something with mynewtool
py-newtool:
    @{{run_check}} "py:newtool" mynewtool .
```

Then add `py-newtool` to the `check-full` dependency list.

**Docker image:** To include the new tool in the Docker image, add it to `docker/pyproject.toml` (for Python tools) or `package.json` (for TypeScript tools). The shared Justfile handles both environments automatically. Then rebuild the image.

## Fixing Issues

**Auto-fix recipes:** Most tools have a `-fix` variant that modifies files in place:
```bash
just py-format-fix    # fix Python formatting
just py-lint-fix      # fix Python lint issues
just ts-format-fix    # fix TypeScript formatting
just ts-lint-fix      # fix TypeScript lint issues
```

**False positives:**
- **vulture:** Add false positives to a `vulture_whitelist.py` file
- **bandit:** Use `# nosec` inline comments or adjust `-ll` severity threshold
- **semgrep:** Add `# nosemgrep: rule-id` inline or adjust `.semgrep.yml` rules
- **ruff:** Use `# noqa: RULE` inline or add rules to `[tool.ruff.lint.per-file-ignores]`

## Project Structure

```
pied_piper/              # Python source code
src/                     # TypeScript source code (when added)
bin/
  pied-piper             # Docker wrapper script (user-facing CLI)
docker/
  entrypoint.sh          # Container CLI router + env stripping
  pyproject.toml         # Container Python deps
scripts/
  run-check.sh           # Output normalizer (OK/FAIL, exit 2)
rules/                   # Custom ast-grep rules
docs/
  README.md              # This file
  tools.md               # Detailed tool reference
  plans/                 # Design docs and implementation plans
Dockerfile               # 4-stage multi-stage build
.dockerignore            # Build context exclusions
install.sh               # curl|sh installer for wrapper script
Justfile                 # All guardrail recipes (shared: native + Docker)
pyproject.toml           # Python deps + ruff/import-linter config
package.json             # TypeScript deps
biome.json               # Biome linter/formatter config
tsconfig.json            # TypeScript compiler config
.semgrep.yml             # Semgrep custom rules
sgconfig.yml             # ast-grep config
.claude/
  settings.local.json    # Claude Code hooks config
.github/
  workflows/
    docker-publish.yml   # CI: build + publish to GHCR
devenv.nix               # Dev environment (provides just, python, node)
```
