# Tool Reference

Detailed reference for each guardrail tool. See [README.md](README.md) for commands and usage.

> These tools are packaged as dependencies of the `piper-py` and `piper-ts` CLI tools. You do not need to install them individually — they are available automatically when you run `uvx piper-py` or `npx piper-ts`.

---

## Python Tools

### ruff (format + lint)

**What it does:** Extremely fast Python linter and formatter, written in Rust. Replaces Black, Flake8, isort, and many Flake8 plugins with a single tool.

**Checks:** `py:format` (fast), `py:lint` (fast)

**Config:** `pyproject.toml`

```toml
[tool.ruff]
line-length = 88
target-version = "py312"
extend-exclude = ["tests/", "test/", "test_*.py", "*_test.py", "conftest.py"]

[tool.ruff.lint]
select = ["E", "F", "W", "I", "N", "UP", "S", "B", "A", "C4", "DTZ",
          "T10", "ISC", "ICN", "PIE", "PT", "RSE", "RET", "SLF", "SIM",
          "TID", "TCH", "ARG", "ERA", "PL", "PERF", "RUF"]
```

**Tuning:**
- Disable a rule project-wide: add to `[tool.ruff.lint.ignore]`
- Disable per-file: use `[tool.ruff.lint.per-file-ignores]`
- Disable per-line: `# noqa: RULE`
- The current rule selection is intentionally broad. Narrow it by removing rule prefixes from the `select` list.

**Docs:** https://docs.astral.sh/ruff/

---

### ty (type checker)

**What it does:** Extremely fast Rust-based Python type checker by Astral (same team as ruff). 10-60x faster than mypy/Pyright without caching. Currently in beta.

**Check:** `py:type` (fast)

**Config:** Can be configured in `pyproject.toml` under `[tool.ty]` (no custom config added yet — using defaults).

**Tuning:**
- ty is in beta — expect occasional false positives
- If ty proves too noisy, consider switching to mypy or pyright

**Docs:** https://github.com/astral-sh/ty

---

### import-linter

**What it does:** Enforces architectural boundaries by defining contracts that restrict which modules can import from which. Prevents the codebase from becoming spaghetti over time.

**Check:** `py:arch` (full) — skips if no `[tool.importlinter]` config in `pyproject.toml`

**Config:** `pyproject.toml` — add a `[tool.importlinter]` section when your project has enough modules to warrant architectural boundaries. Example:

```toml
[tool.importlinter]
root_packages = ["myproject"]

[[tool.importlinter.contracts]]
name = "No direct DB access from API layer"
type = "forbidden"
source_modules = ["myproject.api"]
forbidden_modules = ["myproject.db"]
```

**Contract types:**
- `forbidden` — prevent specific imports
- `layers` — enforce layered architecture (never reversed)
- `independence` — ensure modules don't depend on each other

**Docs:** https://github.com/seddomon/import-linter

---

### vulture

**What it does:** Finds unused Python code — unused functions, classes, variables, imports, and unreachable code via AST analysis. Each finding has a confidence score.

**Check:** `py:deadcode` (full)

**Config:** `--min-confidence 80`

**Tuning:**
- `--min-confidence 80` filters out low-confidence findings (reduce for stricter, increase for quieter)
- Create `vulture_whitelist.py` for known false positives (e.g., Flask route handlers, pytest fixtures)

**Docs:** https://github.com/jendrikseipp/vulture

---

### bandit

**What it does:** Python security linter (SAST). Checks for common security issues: hardcoded passwords, use of `eval()`, SQL injection patterns, insecure hash functions, weak cryptography, etc. Has 68 built-in checks.

**Check:** `py:security` (full)

**Config:** `-r . -q -ll`
- `-r` — recursive scan
- `-q` — quiet output (errors only)
- `-ll` — medium and high severity only (skip low)

**Tuning:**
- `-ll` skips low-severity findings. Change to `-l` for all severities or `-lll` for high only.
- Suppress per-line: `# nosec`
- Suppress per-file: `.bandit` config or `[tool.bandit]` in `pyproject.toml`

**Docs:** https://bandit.readthedocs.io/

---

### complexipy

**What it does:** Enforces cognitive complexity thresholds. Measures how hard code is for a human to understand — penalizes nesting depth and flow-breaking constructs (break, continue, early return, recursion). Written in Rust for speed.

**Check:** `py:complexity` (full)

**Config:** `--max-complexity-allowed 15`
- Functions exceeding a cognitive complexity score of 15 fail the check
- Score of 15 is the SonarSource standard threshold

**Tuning:**
- If thresholds are too strict, increase to `--max-complexity-allowed 20`
- If too lenient, tighten to `--max-complexity-allowed 10`
- Suppress per-line: `# noqa: complexipy`
- Supports `[tool.complexipy]` in `pyproject.toml` for project-level config

**Docs:** https://github.com/rohaquinlop/complexipy

---

### wemake-python-styleguide (strict lint)

**What it does:** The strictest Python linter. A flake8 plugin that enforces opinionated coding standards, catches complexity issues, and ensures "one obvious way to do it." Designed to complement ruff — runs only WPS-specific rules that ruff doesn't cover.

**Check:** `py:lint-strict` (strict) — only runs in `check strict` or individually via `check lint-strict`

**Config:** All via CLI flags (`--select=WPS`). No config file needed in the target project.

**Tuning:**
- Suppress per-line: `# noqa: WPS123`
- To ignore specific rules project-wide, create a `setup.cfg` with `[flake8]` section and `extend-ignore` list
- See full rule list at https://wemake-python-styleguide.readthedocs.io/en/latest/pages/usage/violations/

**Docs:** https://github.com/wemake-services/wemake-python-styleguide

---

## TypeScript Tools

### biome (format + lint)

**What it does:** Fast TypeScript/JavaScript linter and formatter, written in Rust. Replacement for ESLint + Prettier with significantly better performance.

**Checks:** `ts:format` (fast), `ts:lint` (fast)

**Config:** `biome.json` — uses project config if present, biome defaults otherwise.

**Docs:** https://biomejs.dev/

---

### tsc (TypeScript compiler)

**What it does:** TypeScript's built-in type checker. Runs with `--noEmit` to check types without producing output files.

**Check:** `ts:type` (fast)

**Config:** `tsconfig.json` — uses project config if present.

**Docs:** https://www.typescriptlang.org/

---

### dependency-cruiser

**What it does:** Validates and visualizes JavaScript/TypeScript dependency graphs. Enforces rules like "no circular dependencies", "feature modules can't cross-import".

**Check:** `ts:arch` (full) — skips if no `.dependency-cruiser.js` config or no `src/` directory

**Setup:** Run `npx depcruise --init` to generate initial config.

**Docs:** https://github.com/sverweij/dependency-cruiser

---

### knip

**What it does:** Finds unused files, unused exports, unused and unlisted dependencies, and duplicate dependencies in TypeScript/JavaScript projects.

**Check:** `ts:deadcode` (full) — skips if no `.ts` files in `src/`

**Config:** Can use `knip.json` or `package.json` (defaults are good).

**Docs:** https://knip.dev/

---

### type-coverage

**What it does:** Measures what percentage of your TypeScript code has explicit or inferred type coverage. Enforces a minimum threshold to prevent `any` from spreading.

**Check:** `ts:typecov` (full) — skips if no `.ts` files in `src/`

**Config:** `--at-least 80` requires 80% type coverage. Increase as codebase matures.

**Docs:** https://github.com/nicolo-ribaudo/type-coverage

---

## Cross-Language Tools

### semgrep

**What it does:** Structural code analysis tool that matches code patterns. Write rules that look like the code they match. Works across Python, TypeScript, JavaScript, and many other languages.

**Check:** `py:semgrep` (full, in Python tool) — skips if `semgrep` is not on PATH or no `.semgrep.yml`

**Install separately:** `pip install semgrep` or `uv tool install semgrep` (not bundled due to dependency conflicts)

**Config:** `.semgrep.yml` — add custom rules for project-specific patterns.

**Tuning:**
- Suppress per-line: `# nosemgrep: rule-id`
- Use community rulesets: `--config p/python` or `--config p/typescript`

**Docs:** https://semgrep.dev/

---

### ast-grep

**What it does:** Rust-based structural search/lint tool built on tree-sitter. Good for interactive codemods and structural searches.

**Check:** `ts:astgrep` (full, in TypeScript tool) — skips if no `sgconfig.yml`

**Config:** `sgconfig.yml` — points to a `rules/` directory for custom rules.

**Docs:** https://ast-grep.github.io/
