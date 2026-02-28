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
    ./scripts/run-check.sh "ty" uv run ty check --exclude "tests/" --exclude "test/" --exclude "test_*.py" --exclude "*_test.py" --exclude "conftest.py" pied_piper/

# Check Python architectural boundaries
py-arch:
    ./scripts/run-check.sh "import-linter" uv run lint-imports

# Find dead Python code
py-deadcode:
    ./scripts/run-check.sh "vulture" uv run vulture pied_piper/ --min-confidence 80 --exclude "tests/,test/,conftest.py"

# Python security scan
py-security:
    ./scripts/run-check.sh "bandit" uv run bandit -r pied_piper/ -q -ll --exclude ./pied_piper/tests/,./pied_piper/test/

# Audit Python dependencies for vulnerabilities
py-audit:
    ./scripts/run-check.sh "pip-audit" uv run pip-audit

# Check Python code complexity
py-complexity:
    ./scripts/run-check.sh "xenon" uv run xenon --max-absolute B --max-modules A --max-average A --ignore "tests,test" pied_piper/

# Run property-based tests
py-proptest:
    ./scripts/run-check.sh "hypothesis" uv run pytest -m hypothesis -v --tb=short

# Run mutation testing (slow, batch only)
py-mutate:
    uv run mutmut run --paths-to-mutate pied_piper/

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

# Type check TypeScript (skip if no TS source files)
ts-type:
    #!/usr/bin/env bash
    if ! find src/ -name '*.ts' 2>/dev/null | grep -q .; then
        echo "SKIP tsc (no .ts source files found)"
        exit 0
    fi
    ./scripts/run-check.sh "tsc" npx tsc --noEmit

# Check TypeScript architectural boundaries (skip if no config or no src/)
ts-arch:
    #!/usr/bin/env bash
    if [ ! -f .dependency-cruiser.js ] || [ ! -d src/ ]; then
        echo "SKIP dependency-cruiser (no config or no src/ directory)"
        exit 0
    fi
    ./scripts/run-check.sh "dependency-cruiser" npx depcruise src/ --config .dependency-cruiser.js --exclude "(test|tests|__tests__|\\.(test|spec)\\.)"

# Find dead TypeScript code / unused exports (skip if no TS source files)
ts-deadcode:
    #!/usr/bin/env bash
    if ! find src/ -name '*.ts' 2>/dev/null | grep -q .; then
        echo "SKIP knip (no .ts source files found)"
        exit 0
    fi
    ./scripts/run-check.sh "knip" npx knip --exclude files

# Check TypeScript type coverage (skip if no TS source files)
ts-typecov:
    #!/usr/bin/env bash
    if ! find src/ -name '*.ts' 2>/dev/null | grep -q .; then
        echo "SKIP type-coverage (no .ts source files found)"
        exit 0
    fi
    ./scripts/run-check.sh "type-coverage" npx type-coverage --at-least 80 --ignore-files "**/*.test.ts" --ignore-files "**/*.spec.ts" --ignore-files "**/*.test.js" --ignore-files "**/*.spec.js" --ignore-files "**/tests/**" --ignore-files "**/test/**" --ignore-files "**/__tests__/**"

# -- Cross-language recipes --

# Run semgrep custom rules
x-semgrep:
    ./scripts/run-check.sh "semgrep" uv run semgrep scan --config .semgrep.yml --quiet --error pied_piper/

# Run ast-grep structural checks
x-astgrep:
    ./scripts/run-check.sh "ast-grep" npx ast-grep scan --config sgconfig.yml --globs '!**/tests/**' --globs '!**/test/**' --globs '!**/__tests__/**' --globs '!**/*.test.*' --globs '!**/*.spec.*' --globs '!**/test_*' --globs '!**/*_test.py' --globs '!**/conftest.py'

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

# After file edit (PostToolUse hook) -- fast checks only
check-edit: check-fast

# Before Claude stops (Stop hook) -- full architecture suite
check-stop: check-arch

# PR validation -- everything
check-pr: check-all

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
    @uv run python -c "import importlinter; print(importlinter.__version__)" 2>/dev/null && echo "  import-linter: installed" || echo "  import-linter: MISSING"
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
