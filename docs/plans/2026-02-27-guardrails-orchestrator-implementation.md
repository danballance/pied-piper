> **Status: COMPLETED** (2026-02-27)
>
> All 17 tasks implemented. Justfile-based orchestrator operational with 14 tools wired into Claude Code hooks.

# Guardrails Orchestrator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up a Justfile-based guardrails orchestrator with 18 tools across Python, TypeScript, and cross-language groups, wired into Claude Code hooks.

**Architecture:** A single `Justfile` orchestrates all tools. Each tool gets its own recipe. Composite recipes combine tools in progressive order (fast to slow). Claude Code hooks call composite recipes. A small `scripts/run-check.sh` helper normalizes output format across tools.

**Tech Stack:** Just, ruff, ty, import-linter, vulture, bandit, pip-audit, xenon, hypothesis, mutmut (Python); Biome, tsc, dependency-cruiser, knip, type-coverage (TypeScript); semgrep, ast-grep (cross-language)

---

### Task 1: Add `just` to devenv.nix

**Files:**
- Modify: `devenv.nix`

**Step 1: Add just package**

Add `just` to the devenv packages list:

```nix
{pkgs, ...}: {
  # Load .env automatically (API keys).
  dotenv.enable = true;

  # Consolidate Python bytecode into a single directory.
  env.PYTHONPYCACHEPREFIX = ".pycache";

  packages = [
    pkgs.just
  ];

  enterShell = ''
    # Set npm prefix to a writable location for global installs.
    export NPM_CONFIG_PREFIX="$HOME/.npm-global"
    export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"

    # Install pi-coding-agent if not already installed.
    if ! command -v pi &> /dev/null; then
      echo "Installing pi-coding-agent..."
      mkdir -p "$NPM_CONFIG_PREFIX"
      npm install -g @mariozechner/pi-coding-agent
    fi
  '';

  languages.python = {
    enable = true;
    version = "3.12";
    venv.enable = true;
    uv = {
      enable = true;
      sync = {
        enable = true;
        allExtras = true;
      };
    };
  };

  languages.javascript = {
    enable = true;
    npm = {
      enable = true;
      install.enable = true;
    };
  };
}
```

**Step 2: Reload devenv and verify**

Run: `devenv shell -- just --version`
Expected: `just X.Y.Z` (version number)

**Step 3: Commit**

```bash
git add devenv.nix
git commit -m "chore: add just to devenv packages"
```

---

### Task 2: Install Python guardrail tools

**Files:**
- Modify: `pyproject.toml`

**Step 1: Add all Python dev dependencies**

Update `pyproject.toml`:

```toml
[project]
name = "pied-piper"
version = "0.1.0"
description = "Pied Piper AI project"
requires-python = ">=3.12"
dependencies = []

[dependency-groups]
dev = [
    "ruff",
    "ty",
    "import-linter",
    "vulture",
    "bandit",
    "pip-audit",
    "xenon",
    "hypothesis",
    "mutmut",
    "semgrep",
    "pytest",
    "pytest-hypothesis",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

Note: `semgrep` is a Python package so it goes here. `pytest` and `pytest-hypothesis` are added because hypothesis tests run via pytest.

**Step 2: Sync dependencies**

Run: `uv sync`
Expected: All packages install successfully

**Step 3: Verify key tools are available**

Run: `uv run ruff --version && uv run ty --version && uv run vulture --version && uv run bandit --version && uv run semgrep --version`
Expected: Version numbers for each tool

**Step 4: Commit**

```bash
git add pyproject.toml uv.lock
git commit -m "chore: add Python guardrail dev dependencies"
```

---

### Task 3: Install TypeScript guardrail tools

**Files:**
- Create: `package.json`

**Step 1: Initialize package.json and install TS tools**

```bash
npm init -y
npm install --save-dev @biomejs/biome typescript dependency-cruiser knip type-coverage @ast-grep/cli
```

**Step 2: Verify key tools are available**

Run: `npx biome --version && npx tsc --version && npx depcruise --version && npx knip --version && npx ast-grep --version`
Expected: Version numbers for each tool

**Step 3: Add node_modules to .gitignore**

Append to `.gitignore`:
```
# Node
node_modules/
```

**Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: add TypeScript guardrail dev dependencies"
```

---

### Task 4: Create output helper script

**Files:**
- Create: `scripts/run-check.sh`

This script wraps individual tool commands to normalize output. It prints `OK <tool>` on success or `FAIL <tool>` + error output on failure, and exits with code 2 on failure (for Claude Code hooks).

**Step 1: Create the helper script**

```bash
#!/usr/bin/env bash
# Usage: ./scripts/run-check.sh <tool-name> <command...>
# Exits 0 on success, 2 on failure (Claude Code hook convention).

set -euo pipefail

TOOL_NAME="$1"
shift

OUTPUT=$("$@" 2>&1) && RC=0 || RC=$?

if [ "$RC" -eq 0 ]; then
    echo "OK $TOOL_NAME"
else
    echo "FAIL $TOOL_NAME"
    echo "$OUTPUT" | head -20
    exit 2
fi
```

**Step 2: Make it executable**

Run: `chmod +x scripts/run-check.sh`

**Step 3: Test it with a passing command**

Run: `./scripts/run-check.sh "test" echo "hello"`
Expected: `OK test`

**Step 4: Test it with a failing command**

Run: `./scripts/run-check.sh "test" false`
Expected: `FAIL test` followed by exit code 2

**Step 5: Commit**

```bash
git add scripts/run-check.sh
git commit -m "chore: add run-check helper for normalized tool output"
```

---

### Task 5: Create Python tool configs

**Files:**
- Modify: `pyproject.toml` (add tool sections)

**Step 1: Add ruff config**

Append to `pyproject.toml`:

```toml
[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "N", "UP", "S", "B", "A", "C4", "DTZ", "T10", "ISC", "ICN", "PIE", "PT", "RSE", "RET", "SLF", "SIM", "TID", "TCH", "ARG", "ERA", "PL", "PERF", "RUF"]
```

This enables a broad set of ruff rules for the experiment phase.

**Step 2: Add import-linter config**

Append to `pyproject.toml`:

```toml
[tool.importlinter]
root_packages = ["pied_piper"]

[[tool.importlinter.contracts]]
name = "Placeholder contract"
type = "forbidden"
source_modules = ["pied_piper"]
forbidden_modules = []
```

This is a placeholder — real contracts will be added as the project grows modules.

**Step 3: Verify ruff runs clean**

Run: `uv run ruff check pied_piper/`
Expected: No errors (empty `__init__.py` is clean)

Run: `uv run ruff format --check pied_piper/`
Expected: No changes needed

**Step 4: Verify import-linter runs**

Run: `uv run lint-imports`
Expected: Passes (placeholder contract has no forbidden modules)

**Step 5: Commit**

```bash
git add pyproject.toml
git commit -m "chore: add ruff and import-linter config"
```

---

### Task 6: Create TypeScript tool configs

**Files:**
- Create: `biome.json`
- Create: `tsconfig.json`

**Step 1: Create biome config**

Initialize biome and create `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 3: Verify biome runs**

Run: `npx biome check .`
Expected: Runs without errors (no TS source files yet, so nothing to check)

**Step 4: Commit**

```bash
git add biome.json tsconfig.json
git commit -m "chore: add biome and tsconfig configuration"
```

---

### Task 7: Create cross-language tool configs

**Files:**
- Create: `.semgrep.yml`
- Create: `sgconfig.yml`

**Step 1: Create semgrep config**

`.semgrep.yml`:

```yaml
rules:
  - id: no-eval
    patterns:
      - pattern: eval(...)
    message: "eval() is forbidden — use a safer alternative"
    languages: [python]
    severity: ERROR

  - id: no-hardcoded-secrets
    patterns:
      - pattern-regex: "(password|secret|api_key|token)\s*=\s*['\"][^'\"]+['\"]"
    message: "Possible hardcoded secret — use environment variables"
    languages: [python, typescript, javascript]
    severity: WARNING
```

Starting with two basic custom rules. More will be added as the project grows.

**Step 2: Create ast-grep config**

`sgconfig.yml`:

```yaml
ruleDirs:
  - rules
```

Create `rules/` directory (empty for now — rules added as needed).

**Step 3: Verify semgrep runs**

Run: `uv run semgrep scan --config .semgrep.yml pied_piper/`
Expected: Runs clean (no violations in empty `__init__.py`)

**Step 4: Commit**

```bash
mkdir -p rules
touch rules/.gitkeep
git add .semgrep.yml sgconfig.yml rules/.gitkeep
git commit -m "chore: add semgrep and ast-grep configuration"
```

---

### Task 8: Create Justfile — individual Python recipes

**Files:**
- Create: `Justfile`

**Step 1: Create Justfile with Python tool recipes**

```just
# Pied Piper Guardrails Orchestrator
# Usage: just <recipe> or just --list

# -- Python-specific recipes --

# Format Python code with ruff
py-format *FILES='pied_piper/':
    ./scripts/run-check.sh "ruff format" uv run ruff format --check {{FILES}}

# Fix Python formatting in place
py-format-fix *FILES='pied_piper/':
    uv run ruff format {{FILES}}

# Lint Python code with ruff
py-lint *FILES='pied_piper/':
    ./scripts/run-check.sh "ruff check" uv run ruff check {{FILES}}

# Fix Python lint issues in place
py-lint-fix *FILES='pied_piper/':
    uv run ruff check --fix {{FILES}}

# Type check Python with ty
py-type:
    ./scripts/run-check.sh "ty" uv run ty check pied_piper/

# Check Python architectural boundaries
py-arch:
    ./scripts/run-check.sh "import-linter" uv run lint-imports

# Find dead Python code
py-deadcode:
    ./scripts/run-check.sh "vulture" uv run vulture pied_piper/ --min-confidence 80

# Python security scan
py-security:
    ./scripts/run-check.sh "bandit" uv run bandit -r pied_piper/ -q -ll

# Audit Python dependencies for vulnerabilities
py-audit:
    ./scripts/run-check.sh "pip-audit" uv run pip-audit

# Check Python code complexity
py-complexity:
    ./scripts/run-check.sh "xenon" uv run xenon --max-absolute B --max-modules A --max-average A pied_piper/

# Run property-based tests
py-proptest:
    ./scripts/run-check.sh "hypothesis" uv run pytest -m hypothesis -v --tb=short

# Run mutation testing (slow, batch only)
py-mutate:
    uv run mutmut run --paths-to-mutate pied_piper/
```

**Step 2: Verify recipes are listed**

Run: `just --list`
Expected: All py-* recipes listed with descriptions

**Step 3: Verify py-format runs**

Run: `just py-format`
Expected: `OK ruff format`

**Step 4: Verify py-lint runs**

Run: `just py-lint`
Expected: `OK ruff check`

**Step 5: Commit**

```bash
git add Justfile
git commit -m "feat: add Python guardrail recipes to Justfile"
```

---

### Task 9: Add TypeScript recipes to Justfile

**Files:**
- Modify: `Justfile`

**Step 1: Append TypeScript recipes**

Add to `Justfile`:

```just
# -- TypeScript-specific recipes --

# Format TypeScript with biome
ts-format *FILES='.':
    ./scripts/run-check.sh "biome format" npx biome format {{FILES}}

# Fix TypeScript formatting in place
ts-format-fix *FILES='.':
    npx biome format --write {{FILES}}

# Lint TypeScript with biome
ts-lint *FILES='.':
    ./scripts/run-check.sh "biome lint" npx biome lint {{FILES}}

# Fix TypeScript lint issues in place
ts-lint-fix *FILES='.':
    npx biome lint --write {{FILES}}

# Type check TypeScript
ts-type:
    ./scripts/run-check.sh "tsc" npx tsc --noEmit

# Check TypeScript architectural boundaries
ts-arch:
    ./scripts/run-check.sh "dependency-cruiser" npx depcruise src/ --config .dependency-cruiser.js

# Find dead TypeScript code / unused exports
ts-deadcode:
    ./scripts/run-check.sh "knip" npx knip

# Check TypeScript type coverage
ts-typecov:
    ./scripts/run-check.sh "type-coverage" npx type-coverage --at-least 80
```

**Step 2: Verify recipes are listed**

Run: `just --list`
Expected: Both py-* and ts-* recipes listed

**Step 3: Commit**

```bash
git add Justfile
git commit -m "feat: add TypeScript guardrail recipes to Justfile"
```

---

### Task 10: Add cross-language recipes to Justfile

**Files:**
- Modify: `Justfile`

**Step 1: Append cross-language recipes**

Add to `Justfile`:

```just
# -- Cross-language recipes --

# Run semgrep custom rules
x-semgrep:
    ./scripts/run-check.sh "semgrep" uv run semgrep scan --config .semgrep.yml --quiet pied_piper/

# Run ast-grep structural checks
x-astgrep:
    ./scripts/run-check.sh "ast-grep" npx ast-grep scan --config sgconfig.yml
```

**Step 2: Verify semgrep recipe runs**

Run: `just x-semgrep`
Expected: `OK semgrep`

**Step 3: Commit**

```bash
git add Justfile
git commit -m "feat: add cross-language guardrail recipes to Justfile"
```

---

### Task 11: Add composite and hook-targeted recipes

**Files:**
- Modify: `Justfile`

**Step 1: Append composite recipes**

Add to `Justfile`:

```just
# -- Composite recipes (progressive ordering) --

# Fast checks: format + lint + type (< 5s)
check-fast: py-format py-lint py-type ts-format ts-lint ts-type

# Architecture checks: fast + arch + deadcode + security
check-arch: check-fast py-arch py-deadcode py-security py-audit py-complexity ts-arch ts-deadcode ts-typecov x-semgrep x-astgrep

# All checks: arch + property tests
check-all: check-arch py-proptest

# Mutation testing (slow, run separately)
check-mutate: py-mutate

# -- Hook-targeted recipes --

# After file edit (PostToolUse hook) — fast checks only
check-edit: check-fast

# Before Claude stops (Stop hook) — full architecture suite
check-stop: check-arch

# PR validation — everything
check-pr: check-all
```

**Step 2: Verify check-fast runs**

Run: `just check-fast`
Expected: `OK` for each tool in sequence

**Step 3: Commit**

```bash
git add Justfile
git commit -m "feat: add composite and hook-targeted recipes"
```

---

### Task 12: Add utility recipes

**Files:**
- Modify: `Justfile`

**Step 1: Append utility recipes**

Add to `Justfile`:

```just
# -- Utility recipes --

# Install all guardrail tools
tools-install:
    uv sync
    npm install

# Check which tools are installed and their versions
tools-status:
    @echo "=== Python tools ==="
    @uv run ruff --version 2>/dev/null && echo "  ruff: installed" || echo "  ruff: MISSING"
    @uv run ty --version 2>/dev/null && echo "  ty: installed" || echo "  ty: MISSING"
    @uv run lint-imports --version 2>/dev/null && echo "  import-linter: installed" || echo "  import-linter: MISSING"
    @uv run vulture --version 2>/dev/null && echo "  vulture: installed" || echo "  vulture: MISSING"
    @uv run bandit --version 2>/dev/null && echo "  bandit: installed" || echo "  bandit: MISSING"
    @uv run pip-audit --version 2>/dev/null && echo "  pip-audit: installed" || echo "  pip-audit: MISSING"
    @uv run xenon --version 2>/dev/null && echo "  xenon: installed" || echo "  xenon: MISSING"
    @uv run semgrep --version 2>/dev/null && echo "  semgrep: installed" || echo "  semgrep: MISSING"
    @echo ""
    @echo "=== TypeScript tools ==="
    @npx biome --version 2>/dev/null && echo "  biome: installed" || echo "  biome: MISSING"
    @npx tsc --version 2>/dev/null && echo "  tsc: installed" || echo "  tsc: MISSING"
    @npx depcruise --version 2>/dev/null && echo "  dependency-cruiser: installed" || echo "  dependency-cruiser: MISSING"
    @npx knip --version 2>/dev/null && echo "  knip: installed" || echo "  knip: MISSING"
    @npx type-coverage --version 2>/dev/null && echo "  type-coverage: installed" || echo "  type-coverage: MISSING"
    @npx ast-grep --version 2>/dev/null && echo "  ast-grep: installed" || echo "  ast-grep: MISSING"
```

**Step 2: Verify tools-status**

Run: `just tools-status`
Expected: List of tools with installed/MISSING status

**Step 3: Commit**

```bash
git add Justfile
git commit -m "feat: add tools-install and tools-status utility recipes"
```

---

### Task 13: Wire up Claude Code hooks

**Files:**
- Modify: `.claude/settings.local.json`

**Step 1: Add hooks to settings**

Update `.claude/settings.local.json` to add hooks alongside existing permissions:

```json
{
  "permissions": {
    "allow": [
      "Bash(git*log:*)"
    ],
    "deny": [
      "Read(.env)",
      "Bash(*.env*)",
      "Grep(*.env*)"
    ]
  },
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

**Step 2: Commit**

```bash
git add .claude/settings.local.json
git commit -m "feat: wire guardrail recipes into Claude Code hooks"
```

---

### Task 14: Create sample Python code to test guardrails

**Files:**
- Create: `pied_piper/sample.py`

To validate all tools work on real code, create a small sample module with intentional issues that some tools should catch.

**Step 1: Write sample code**

```python
"""Sample module to test guardrails."""


def greet(name: str) -> str:
    """Return a greeting."""
    return f"Hello, {name}!"


def add(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b
```

This is clean code — all tools should pass on it.

**Step 2: Run the full fast check suite**

Run: `just check-fast`
Expected: All `OK`

**Step 3: Run the full architecture check suite**

Run: `just check-arch`
Expected: All `OK` (or identify tools that need config tuning)

**Step 4: Document any tools that need adjustment**

If any tool fails unexpectedly, note the issue and adjust config or recipe flags.

**Step 5: Commit**

```bash
git add pied_piper/sample.py
git commit -m "feat: add sample module for guardrails validation"
```

---

### Task 15: Validate and tune each tool individually

**Files:**
- Possibly modify: `pyproject.toml`, `Justfile`, `.semgrep.yml`, `biome.json`

Run each tool recipe individually and fix any configuration issues:

**Step 1: Run and verify each Python tool**

```bash
just py-format
just py-lint
just py-type
just py-arch
just py-deadcode
just py-security
just py-audit
just py-complexity
```

For each tool that fails, diagnose whether the failure is a real issue or a config problem, and fix accordingly.

**Step 2: Run and verify each TypeScript tool**

```bash
just ts-format
just ts-lint
just ts-type
just ts-arch
just ts-deadcode
just ts-typecov
```

Note: Many TS tools will have nothing to check (no `.ts` files yet). Verify they exit cleanly with no source files.

**Step 3: Run and verify cross-language tools**

```bash
just x-semgrep
just x-astgrep
```

**Step 4: Run full composite check**

Run: `just check-fast`
Then: `just check-stop`

**Step 5: Fix any issues found and commit**

```bash
git add -A
git commit -m "fix: tune guardrail tool configs after validation"
```

---

### Task 16: Update .gitignore and final cleanup

**Files:**
- Modify: `.gitignore`

**Step 1: Ensure all generated files are ignored**

Verify `.gitignore` covers:
```
# Environment and secrets
.env

# devenv / direnv
.devenv/
.direnv/

# Python
.venv/
__pycache__/
*.pyc
.pycache/

# Node
node_modules/

# Project outputs
results/*
!results/.gitkeep

# Tool caches
.semgrep/
.mutmut-cache/
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: update .gitignore for tool caches"
```

---

### Task 17: End-to-end validation

**No files to modify — just run and verify.**

**Step 1: Run `just tools-status`**

Verify all tools show as installed.

**Step 2: Run `just check-fast`**

Verify all fast checks pass.

**Step 3: Run `just check-stop`**

Verify the full architecture suite passes.

**Step 4: Test the Claude Code hook flow**

Make a trivial edit to `pied_piper/sample.py` (e.g., add a docstring) and verify that Claude Code's PostToolUse hook runs `just check-edit` and reports results.

**Step 5: Test failure detection**

Temporarily introduce a lint error in `pied_piper/sample.py` (e.g., `x = 1` unused variable), run `just check-edit`, verify it exits with code 2 and shows the FAIL output. Then revert the error.

**Step 6: Final commit if any tweaks were needed**

```bash
git add -A
git commit -m "chore: final guardrails orchestrator tuning"
```
