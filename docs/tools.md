# Tool Reference

Detailed reference for each guardrail tool. See [README.md](README.md) for recipes and usage.

> **Docker users:** The Docker image (`pied-piper check-fast`, etc.) packages all these tools internally. You do not need to install or configure them individually. This reference is for the native Justfile workflow and for understanding what runs under the hood.

---

## Python Tools

### ruff (format + lint)

**What it does:** Extremely fast Python linter and formatter, written in Rust. Replaces Black, Flake8, isort, and many Flake8 plugins with a single tool.

**Version:** 0.15.4

**Config:** `pyproject.toml`

```toml
[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "N", "UP", "S", "B", "A", "C4", "DTZ",
          "T10", "ISC", "ICN", "PIE", "PT", "RSE", "RET", "SLF", "SIM",
          "TID", "TCH", "ARG", "ERA", "PL", "PERF", "RUF"]
```

**Recipes:**
- `just py-format` — check formatting (exit 2 if unformatted)
- `just py-format-fix` — fix formatting in place
- `just py-lint` — check lint rules (exit 2 on violations)
- `just py-lint-fix` — auto-fix lint issues

**Tuning:**
- Disable a rule project-wide: add to `[tool.ruff.lint.ignore]`
- Disable per-file: use `[tool.ruff.lint.per-file-ignores]`
- Disable per-line: `# noqa: RULE`
- The current rule selection is intentionally broad for experimentation. Narrow it by removing rule prefixes from the `select` list.

**Docs:** https://docs.astral.sh/ruff/

---

### ty (type checker)

**What it does:** Extremely fast Rust-based Python type checker by Astral (same team as ruff). 10-60x faster than mypy/Pyright without caching. Currently in beta.

**Version:** 0.0.19

**Config:** Can be configured in `pyproject.toml` under `[tool.ty]` (no custom config added yet — using defaults).

**Recipe:** `just py-type`

**Tuning:**
- ty is in beta — expect occasional false positives
- If ty proves too noisy, consider switching to mypy or pyright (change the recipe command)

**Docs:** https://github.com/astral-sh/ty

---

### import-linter

**What it does:** Enforces architectural boundaries by defining contracts that restrict which modules can import from which. Prevents the codebase from becoming spaghetti over time.

**Version:** 2.6

**Config:** `pyproject.toml`

```toml
[tool.importlinter]
root_packages = ["pied_piper"]

[[tool.importlinter.contracts]]
name = "Placeholder contract"
type = "forbidden"
source_modules = ["pied_piper"]
forbidden_modules = []
```

**Recipe:** `just py-arch`

**Contract types:**
- `forbidden` — prevent specific imports (e.g., no ORM in API layer)
- `layers` — enforce layered architecture (views → services → models, never reversed)
- `independence` — ensure modules don't depend on each other

**Tuning:**
- The current config has a placeholder contract with no forbidden modules
- As the project grows, define real contracts based on your module structure
- Example: prevent `pied_piper.api` from importing `pied_piper.db` directly

**Docs:** https://github.com/seddomon/import-linter

---

### vulture

**What it does:** Finds unused Python code — unused functions, classes, variables, imports, and unreachable code via AST analysis. Each finding has a confidence score.

**Version:** 2.14

**Config:** CLI flags in Justfile: `--min-confidence 80`

**Recipe:** `just py-deadcode`

**Tuning:**
- `--min-confidence 80` filters out low-confidence findings (reduce for stricter, increase for quieter)
- Create `vulture_whitelist.py` for known false positives (e.g., Flask route handlers, pytest fixtures)
- Add the whitelist: `uv run vulture pied_piper/ vulture_whitelist.py --min-confidence 80`

**Docs:** https://github.com/jendrikseipp/vulture

---

### bandit

**What it does:** Python security linter (SAST). Checks for common security issues: hardcoded passwords, use of `eval()`, SQL injection patterns, insecure hash functions, weak cryptography, etc. Has 68 built-in checks.

**Version:** 1.9.4

**Config:** CLI flags in Justfile: `-r pied_piper/ -q -ll`
- `-r` — recursive scan
- `-q` — quiet output (errors only)
- `-ll` — medium and high severity only (skip low)

**Recipe:** `just py-security`

**Tuning:**
- `-ll` skips low-severity findings. Change to `-l` for all severities or `-lll` for high only.
- Suppress per-line: `# nosec`
- Suppress per-file: `.bandit` config or `[tool.bandit]` in `pyproject.toml`

**Docs:** https://bandit.readthedocs.io/

---

### pip-audit

**What it does:** Scans Python dependencies for known vulnerabilities by checking against the OSV (Open Source Vulnerabilities) database. Works with pip, poetry, and uv lock files.

**Version:** 2.9.0

**Config:** No config file — runs against the current environment's installed packages.

**Recipe:** `just py-audit`

> **Note:** pip-audit is excluded from the Docker image because it requires network access to query vulnerability databases, which conflicts with the `--network none` security policy. It remains available via the native workflow (`just py-audit`).

**Tuning:**
- Produces zero output when clean
- If a vulnerability is found, it reports the package, version, and CVE
- Fix by updating the dependency: `uv lock --upgrade-package <package>`

**Docs:** https://github.com/pypa/pip-audit

---

### xenon

**What it does:** Enforces code complexity thresholds. Wraps radon (which computes cyclomatic complexity, Halstead metrics, and maintainability index) and exits non-zero when thresholds are exceeded.

**Version:** 0.9.3

**Config:** CLI flags in Justfile: `--max-absolute B --max-modules A --max-average A`
- `--max-absolute B` — no single function can exceed "B" complexity (11-15)
- `--max-modules A` — no module can exceed "A" complexity (1-5)
- `--max-average A` — average complexity across all modules must be "A"

Grades: A (1-5), B (6-10 or 11-15 depending on metric), C (16-25+)

**Recipe:** `just py-complexity`

**Tuning:**
- If thresholds are too strict, loosen to `--max-absolute C`
- If too lenient, tighten to `--max-absolute A`

**Docs:** https://github.com/rubik/xenon

---

### hypothesis

**What it does:** Property-based testing framework. Instead of testing specific examples, you define properties that must hold for all inputs, and Hypothesis generates hundreds of random test cases automatically, with automatic shrinking to minimal failing cases.

**Version:** 6.151.9

**Config:** Tests are marked with `@given` decorator and `pytest -m hypothesis` marker.

**Recipe:** `just py-proptest`

**Usage:**
```python
from hypothesis import given
from hypothesis import strategies as st

@given(st.integers(), st.integers())
def test_add_commutative(a, b):
    assert add(a, b) == add(b, a)
```

**Docs:** https://hypothesis.readthedocs.io/

---

### mutmut

**What it does:** Mutation testing — makes small changes to source code (replacing `>` with `>=`, `True` with `False`, etc.) and runs your test suite. Surviving mutants reveal gaps in test coverage. Validates that tests actually catch bugs, not just execute code.

**Version:** 3.5.0

**Config:** CLI flags in Justfile: `--paths-to-mutate pied_piper/`

**Recipe:** `just py-mutate` (slow, run manually)

**Tuning:**
- Very slow — runs your full test suite for each mutation
- Use `--paths-to-mutate` to limit scope
- Results are cached in `.mutmut-cache/` (gitignored)

**Docs:** https://mutmut.readthedocs.io/

---

## TypeScript Tools

### biome (format + lint)

**What it does:** Fast TypeScript/JavaScript linter and formatter, written in Rust. Replacement for ESLint + Prettier with significantly better performance.

**Version:** 2.4.4

**Config:** `biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.4/schema.json",
  "files": {
    "includes": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.js", "src/**/*.jsx",
                 "biome.json", "tsconfig.json", "package.json"]
  },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 }
}
```

The `files.includes` whitelist prevents biome from scanning non-project files (like `.devenv/` HTML files).

**Recipes:**
- `just ts-format` — check formatting
- `just ts-format-fix` — fix formatting in place
- `just ts-lint` — check lint rules
- `just ts-lint-fix` — auto-fix lint issues

**Docs:** https://biomejs.dev/

---

### tsc (TypeScript compiler)

**What it does:** TypeScript's built-in type checker. Runs with `--noEmit` to check types without producing output files.

**Version:** 5.9.3

**Config:** `tsconfig.json`

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

**Recipe:** `just ts-type` (skips gracefully if no `.ts` files in `src/`)

**Docs:** https://www.typescriptlang.org/

---

### dependency-cruiser

**What it does:** Validates and visualizes JavaScript/TypeScript dependency graphs. Enforces rules like "no circular dependencies", "feature modules can't cross-import", "no test code in production imports".

**Version:** 17.3.8

**Config:** `.dependency-cruiser.js` (not yet created — recipe skips gracefully)

**Recipe:** `just ts-arch` (skips if no config or no `src/` directory)

**Setup:** Run `npx depcruise --init` to generate initial config.

**Docs:** https://github.com/sverweij/dependency-cruiser

---

### knip

**What it does:** Finds unused files, unused exports, unused and unlisted dependencies, and duplicate dependencies in TypeScript/JavaScript projects. Auto-detects 50+ frameworks via plugins.

**Version:** 5.85.0

**Config:** Can use `knip.json` or `package.json` (no custom config yet — using defaults).

**Recipe:** `just ts-deadcode` (skips if no `.ts` files in `src/`)

**Docs:** https://knip.dev/

---

### type-coverage

**What it does:** Measures what percentage of your TypeScript code has explicit or inferred type coverage. Enforces a minimum threshold to prevent `any` from spreading.

**Version:** 2.29.7

**Config:** CLI flags in Justfile: `--at-least 80`

**Recipe:** `just ts-typecov` (skips if no `.ts` files in `src/`)

**Tuning:**
- `--at-least 80` requires 80% type coverage. Increase as codebase matures.

**Docs:** https://github.com/nicolo-ribaudo/type-coverage

---

## Cross-Language Tools

### semgrep

**What it does:** Structural code analysis tool that matches code patterns. Write rules that look like the code they match. Works across Python, TypeScript, JavaScript, and many other languages from a single YAML ruleset. Also has 20,000+ community rules for security scanning.

**Version:** 1.153.1

**Config:** `.semgrep.yml`

```yaml
rules:
  - id: no-eval
    patterns:
      - pattern: eval(...)
    message: "eval() is forbidden"
    languages: [python]
    severity: ERROR

  - id: no-hardcoded-secrets
    patterns:
      - pattern-regex: '(password|secret|api_key|token)\s*=\s*...'
    message: "Possible hardcoded secret"
    languages: [python, typescript, javascript]
    severity: WARNING
```

**Recipe:** `just x-semgrep`

**CLI flags:** `--quiet --error` (quiet output, exit non-zero on findings)

**Tuning:**
- Add custom rules to `.semgrep.yml` for project-specific patterns
- Suppress per-line: `# nosemgrep: rule-id`
- Use community rulesets: `--config p/python` or `--config p/typescript`

**Docs:** https://semgrep.dev/

---

### ast-grep

**What it does:** Rust-based structural search/lint tool built on tree-sitter. Blazingly fast. Good for interactive codemods and one-off structural searches. Complements semgrep with superior performance and embeddability.

**Version:** 0.41.0

**Config:** `sgconfig.yml` (points to `rules/` directory for custom rules)

**Recipe:** `just x-astgrep`

**Usage:** Add YAML rule files to the `rules/` directory.

**Docs:** https://ast-grep.github.io/
