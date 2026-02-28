# Pied Piper Guardrails Orchestrator
# Usage: just <recipe> or just --list
#
# Shared Justfile for native and Docker workflows.
# Auto-detects mode via PIED_PIPER_MODE env var (set by Dockerfile).

mode := env_var_or_default("PIED_PIPER_MODE", "native")

config := if mode == "docker" { "/etc/pied-piper" } else { "." }
run_check := if mode == "docker" { "/opt/pied-piper/scripts/run-check.sh" } else { "./scripts/run-check.sh" }
exclude_dirs := ".venv,.devenv,.direnv,node_modules,dist,build,.next,__pycache__,.git,tests,test,__tests__"

venv_bin := if mode == "docker" { "/opt/venv/bin" } else { ".venv/bin" }
node_bin := if mode == "docker" { "/opt/node_modules/.bin" } else { "node_modules/.bin" }
export PATH := venv_bin + ":" + node_bin + ":" + env_var("PATH")

# -- Python checks --

# Format Python code
py-format *FILES='.':
    @{{run_check}} "py:format" ruff format --check --cache-dir /tmp/ruff-cache --config {{config}}/pyproject.toml {{FILES}}

# Lint Python code
py-lint *FILES='.':
    @{{run_check}} "py:lint" ruff check --cache-dir /tmp/ruff-cache --config {{config}}/pyproject.toml {{FILES}}

# Type check Python
py-type:
    #!/usr/bin/env bash
    ty_args=(check --exclude ".venv/" --exclude ".devenv/" --exclude "node_modules/" \
             --exclude "tests/" --exclude "test/" --exclude "test_*.py" \
             --exclude "*_test.py" --exclude "conftest.py")
    for sp in .venv/lib/python*/site-packages; do
        if [ -d "$sp" ]; then
            ty_args+=(--extra-search-path "$sp")
        fi
    done
    {{run_check}} "py:typecheck" ty "${ty_args[@]}" .

# Check Python architectural boundaries
py-arch:
    #!/usr/bin/env bash
    if [ -f pyproject.toml ] && grep -q '\[tool.importlinter\]' pyproject.toml; then
        {{run_check}} "py:architecture" lint-imports --no-cache
    else
        echo "SKIP py:architecture (no [tool.importlinter] config in project)"
    fi

# Find dead Python code
py-deadcode:
    @{{run_check}} "py:deadcode" vulture . --min-confidence 80 --exclude {{exclude_dirs}}

# Python security scan
py-security:
    @{{run_check}} "py:security" bandit -r . -q -ll --exclude ./.venv,./.devenv,./.direnv,./node_modules,./dist,./build,./.next,./tests,./test

# Check Python code complexity
py-complexity:
    @{{run_check}} "py:complexity" xenon --max-absolute B --max-modules A --max-average A --exclude "{{exclude_dirs}}" .

# -- Python fix recipes --

# Fix Python formatting in place
py-format-fix *FILES='.':
    ruff format --cache-dir /tmp/ruff-cache --config {{config}}/pyproject.toml {{FILES}}

# Fix Python lint issues in place
py-lint-fix *FILES='.':
    ruff check --cache-dir /tmp/ruff-cache --fix --config {{config}}/pyproject.toml {{FILES}}

# -- TypeScript checks --

# Format TypeScript/JS code
ts-format *FILES='.':
    #!/usr/bin/env bash
    if ! find . \( -path ./node_modules -o -path ./.venv -o -path ./.devenv -o -path ./dist -o -path ./build -o -path ./.next \) -prune -o \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -print 2>/dev/null | head -1 | grep -q .; then
        echo "SKIP ts:format (no JS/TS source files found)"
        exit 0
    fi
    {{run_check}} "ts:format" biome format --config-path {{config}} {{FILES}}

# Lint TypeScript/JS code
ts-lint *FILES='.':
    #!/usr/bin/env bash
    if ! find . \( -path ./node_modules -o -path ./.venv -o -path ./.devenv -o -path ./dist -o -path ./build -o -path ./.next \) -prune -o \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -print 2>/dev/null | head -1 | grep -q .; then
        echo "SKIP ts:lint (no JS/TS source files found)"
        exit 0
    fi
    {{run_check}} "ts:lint" biome lint --config-path {{config}} {{FILES}}

# Type check TypeScript
ts-type:
    #!/usr/bin/env bash
    if ! find . \( -path ./node_modules -o -path ./.venv -o -path ./.devenv -o -path ./dist -o -path ./build -o -path ./.next \) -prune -o -name '*.ts' -print 2>/dev/null | head -1 | grep -q .; then
        echo "SKIP ts:typecheck (no .ts source files found)"
        exit 0
    fi
    if [ -f tsconfig.json ]; then
        {{run_check}} "ts:typecheck" tsc --noEmit
    else
        cat > /tmp/tsconfig.json <<'TSCONF'
    {
      "compilerOptions": {
        "target": "ES2022", "module": "Node16", "moduleResolution": "Node16",
        "strict": true, "noEmit": true, "skipLibCheck": true, "esModuleInterop": true
      },
      "include": ["**/*.ts", "**/*.tsx"],
      "exclude": [
        "node_modules", "dist", "build", ".next",
        "**/*.test.ts", "**/*.spec.ts",
        "**/__tests__/**", "**/test/**", "**/tests/**"
      ]
    }
    TSCONF
        {{run_check}} "ts:typecheck" tsc -p /tmp/tsconfig.json
    fi

# Check TypeScript architectural boundaries
ts-arch:
    #!/usr/bin/env bash
    if [ ! -f .dependency-cruiser.js ] || [ ! -d src/ ]; then
        echo "SKIP ts:architecture (no config or no src/ directory)"
        exit 0
    fi
    {{run_check}} "ts:architecture" depcruise src/ --config .dependency-cruiser.js --exclude "(test|tests|__tests__|\\.(test|spec)\\.)"

# Find dead TypeScript code / unused exports
ts-deadcode:
    #!/usr/bin/env bash
    if ! find src/ -name '*.ts' 2>/dev/null | grep -q .; then
        echo "SKIP ts:deadcode (no .ts source files found)"
        exit 0
    fi
    {{run_check}} "ts:deadcode" knip --exclude files

# Check TypeScript type coverage
ts-typecov:
    #!/usr/bin/env bash
    if ! find src/ -name '*.ts' 2>/dev/null | grep -q .; then
        echo "SKIP ts:typecov (no .ts source files found)"
        exit 0
    fi
    {{run_check}} "ts:typecov" type-coverage --at-least 80 --ignore-files "**/*.test.ts" --ignore-files "**/*.spec.ts" --ignore-files "**/*.test.js" --ignore-files "**/*.spec.js" --ignore-files "**/tests/**" --ignore-files "**/test/**" --ignore-files "**/__tests__/**"

# -- TypeScript fix recipes --

# Fix TypeScript formatting in place
ts-format-fix *FILES='.':
    #!/usr/bin/env bash
    if ! find . \( -path ./node_modules -o -path ./.venv -o -path ./.devenv -o -path ./dist -o -path ./build -o -path ./.next \) -prune -o \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -print 2>/dev/null | head -1 | grep -q .; then
        echo "SKIP ts:format-fix (no JS/TS source files found)"
        exit 0
    fi
    biome format --write --config-path {{config}} {{FILES}}

# Fix TypeScript lint issues in place
ts-lint-fix *FILES='.':
    #!/usr/bin/env bash
    if ! find . \( -path ./node_modules -o -path ./.venv -o -path ./.devenv -o -path ./dist -o -path ./build -o -path ./.next \) -prune -o \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -print 2>/dev/null | head -1 | grep -q .; then
        echo "SKIP ts:lint-fix (no JS/TS source files found)"
        exit 0
    fi
    biome lint --write --config-path {{config}} {{FILES}}

# -- Cross-language checks --

# Run semgrep custom rules
x-semgrep:
    @{{run_check}} "x:security" semgrep scan --config {{config}}/.semgrep.yml --quiet --error --metrics=off --exclude .venv --exclude .devenv --exclude node_modules --exclude dist --exclude build --exclude tests --exclude test --exclude __tests__ --exclude "*_test.py" --exclude "test_*.py" --exclude "*.test.*" --exclude "*.spec.*" --exclude conftest.py .

# Run ast-grep structural checks
x-astgrep:
    @{{run_check}} "x:lint" ast-grep scan --config {{config}}/sgconfig.yml --globs '!**/tests/**' --globs '!**/test/**' --globs '!**/__tests__/**' --globs '!**/*.test.*' --globs '!**/*.spec.*' --globs '!**/test_*' --globs '!**/*_test.py' --globs '!**/conftest.py'

# -- Composite recipes --

# Fast checks: format + lint + type (< 5s)
check-fast: py-format py-lint py-type ts-format ts-lint ts-type

# Full checks: fast + architecture + security + dead code + complexity + semgrep + ast-grep
check-full: check-fast py-arch py-deadcode py-security py-complexity ts-arch ts-deadcode ts-typecov x-semgrep x-astgrep

# -- Hook-targeted recipes --

# After file edit (PostToolUse hook)
check-edit: check-fast

# Before Claude stops (Stop hook)
check-stop: check-full

# PR validation
check-pr: check-full

# -- Fix recipe --

# Auto-fix formatting and lint issues
fix:
    #!/usr/bin/env bash
    ruff format --cache-dir /tmp/ruff-cache --config {{config}}/pyproject.toml .
    ruff check --cache-dir /tmp/ruff-cache --fix --config {{config}}/pyproject.toml . || true
    if find . \( -path ./node_modules -o -path ./.venv -o -path ./.devenv -o -path ./dist -o -path ./build -o -path ./.next \) -prune -o \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -print 2>/dev/null | head -1 | grep -q .; then
        biome format --write --config-path {{config}} .
        biome lint --write --config-path {{config}} . || true
    fi
    echo "OK fix"

# -- Utility recipes (native only) --

# Install all guardrail tools
tools-install:
    uv sync
    npm install

# Check which tools are installed
tools-status:
    @echo "=== Python tools ==="
    @ruff --version 2>/dev/null && echo "  ruff: installed" || echo "  ruff: MISSING"
    @ty --version 2>/dev/null && echo "  ty: installed" || echo "  ty: MISSING"
    @python -c "import importlinter; print(importlinter.__version__)" 2>/dev/null && echo "  import-linter: installed" || echo "  import-linter: MISSING"
    @vulture --version 2>/dev/null && echo "  vulture: installed" || echo "  vulture: MISSING"
    @bandit --version 2>/dev/null && echo "  bandit: installed" || echo "  bandit: MISSING"
    @xenon --version 2>/dev/null && echo "  xenon: installed" || echo "  xenon: MISSING"
    @semgrep --version 2>/dev/null && echo "  semgrep: installed" || echo "  semgrep: MISSING"
    @echo ""
    @echo "=== TypeScript tools ==="
    @biome --version 2>/dev/null && echo "  biome: installed" || echo "  biome: MISSING"
    @tsc --version 2>/dev/null && echo "  tsc: installed" || echo "  tsc: MISSING"
    @depcruise --version 2>/dev/null && echo "  dependency-cruiser: installed" || echo "  dependency-cruiser: MISSING"
    @knip --version 2>/dev/null && echo "  knip: installed" || echo "  knip: MISSING"
    @type-coverage --version 2>/dev/null && echo "  type-coverage: installed" || echo "  type-coverage: MISSING"
    @ast-grep --version 2>/dev/null && echo "  ast-grep: installed" || echo "  ast-grep: MISSING"
