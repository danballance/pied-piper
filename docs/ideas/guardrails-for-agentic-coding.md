# Deterministic guardrails for agentic coding beyond the basics

**The most impactful tools you're likely missing are architectural boundary enforcement (import-linter, dependency-cruiser), dead code detection (Knip, Vulture), custom structural rules (Semgrep, ast-grep), and property-based testing (Hypothesis, fast-check).** These fill the critical gap between "does the code compile and pass tests" and "does the code actually conform to our architecture and invariants." Combined with agentic feedback loop patterns — where check results feed directly back to the AI for self-correction — these tools become force multipliers. The ecosystem has matured significantly through 2025-2026, with purpose-built hooks systems in Claude Code, Cursor, and Aider making it straightforward to wire deterministic checks into the agent's generate-fix cycle.

---

## Architectural boundary enforcement stops agents from creating spaghetti

The single highest-leverage addition to your pipeline is likely **architectural boundary checking** — tools that enforce dependency rules between modules so an AI agent can't silently violate your layered architecture.

**For Python, import-linter** (github.com/seddomon/import-linter) is the gold standard. You define "contracts" in `pyproject.toml` specifying allowed dependency directions — for example, that `views` may depend on `services` which may depend on `models`, but never the reverse. Running `lint-imports` exits non-zero on violations. It supports layer contracts, forbidden-import contracts, and independence contracts. Under the hood it uses **grimp** to build a NetworkX import graph, so it's fast and deterministic. This is particularly critical for agentic workflows because LLMs have no inherent understanding of your architectural boundaries — they'll happily import your ORM models directly into your API handlers.

**For TypeScript, dependency-cruiser** (github.com/sverweij/dependency-cruiser) fills the same role. It validates and visualizes dependency graphs using regex-based path matching rules: forbid imports from `test/` in production code, enforce that feature modules don't cross-import, detect circular dependencies. Configuration lives in `.dependency-cruiser.js` and outputs in multiple formats including JSON, Mermaid, and Graphviz. Two newer alternatives worth evaluating: **Sheriff** (`@softarc/sheriff-core`) uses tag-based rules in TypeScript config files and supports both ESLint integration and standalone CLI, while **eslint-plugin-boundaries** integrates boundary enforcement directly into your ESLint pipeline.

For cross-language enforcement, **Semgrep** can encode architectural rules as YAML patterns — for instance, preventing direct database calls outside your repository layer or banning certain import patterns. This works identically across Python and TypeScript with a single tool.

---

## Dead code detection, security scanning, and code smell analysis

**Dead code detection** is a natural complement to AI-generated code, which frequently introduces unused functions or orphan files. For Python, **Vulture** (github.com/jendrikseipp/vulture) finds unused functions, classes, variables, and unreachable code via AST analysis, with confidence scoring from 60-100%. The newer **deadcode** (github.com/albertas/deadcode), presented at EuroPython 2024, offers scope-aware detection with fewer false positives and a `--fix` auto-removal option. For TypeScript, **Knip** (knip.dev) is the clear winner — it finds unused files, unused exports, unused and unlisted dependencies, and duplicate dependencies. It auto-detects **50+ frameworks** via plugins. Vercel reportedly used Knip to delete ~300k lines of unused code. Run `npx knip --max-issues 0` as a hard CI gate.

**Security scanning** deserves its own layer in your guardrail stack. **Semgrep** (semgrep.dev) is the most versatile option — it's fast, supports both Python and TypeScript, has **20,000+ rules** in its registry, and lets you write custom rules in human-readable YAML. GitLab has officially transitioned its SAST analyzers to Semgrep. For Python-specific SAST, **Bandit** remains useful for its 68 built-in AST checks (hardcoded passwords, SQL injection, eval usage). For dependency vulnerabilities, use **pip-audit** (Python, checks against the OSV database) and **Socket.dev** (TypeScript/npm, which goes beyond CVEs to detect actual malicious code patterns like obfuscation, network access, and install scripts — critical after the September 2025 npm supply chain attacks).

**Complexity and code smell analysis** beyond cyclomatic complexity: **Cognitive complexity** (SonarSource's metric, available via flake8-cognitive-complexity for Python and SonarQube for both languages) better measures how hard code is to understand. **Radon** computes Halstead metrics and maintainability index for Python, while **xenon** wraps radon as an enforcement gate — `xenon --max-absolute B --max-modules A mypackage/` exits non-zero when thresholds are exceeded. For extreme strictness, **wemake-python-styleguide** offers **400+ rules** covering complexity, consistency, and naming as a flake8 plugin.

---

## AST-based custom rules and structural code analysis

For project-specific conventions that no off-the-shelf linter covers, two tools stand out for writing custom structural rules:

**Semgrep** lets you write rules that look like the code they match. A rule banning `eval()` in Python is literally `pattern: eval(...)`. You can combine patterns with `patterns`, `pattern-not`, `pattern-inside`, and metavariable constraints to express complex invariants. Semgrep works across both Python and TypeScript from a single YAML ruleset, making it ideal for monorepos. Its autofix engine achieves **96.4% accuracy for Python and 100% for TypeScript**. This is arguably the single most important cross-language guardrail tool.

**ast-grep** (ast-grep.github.io) is a Rust-based alternative built on tree-sitter that's blazingly fast and offers a Node.js API for programmatic access. It excels at interactive codemods and one-off structural searches. Where Semgrep has the larger rule ecosystem and cross-file analysis, ast-grep has superior performance and embeddability.

**LibCST** (github.com/Instagram/LibCST, by Meta) is Python-specific but uniquely powerful — it parses a Concrete Syntax Tree that preserves all formatting, enabling lossless round-trip code transformations. Its codemod framework is ideal for building custom validation visitors that check for anti-patterns while preserving whitespace and comments. The fully typed API with metadata resolvers for qualified names and call graphs makes it suitable for sophisticated checks like "ensure all functions in this module have a specific decorator."

For Ruff's current state: it now covers **900+ lint rules** reimplemented in Rust and serves as a drop-in replacement for Black, Flake8, isort, and many plugins. It does not do type checking. However, Astral released **ty** in December 2025 — an extremely fast Rust-based type checker that's **10-60x faster than mypy/Pyright** without caching. It's in beta, but its speed makes it viable for running on every agent iteration.

---

## Property-based testing, contracts, and mutation testing

**Property-based testing** is one of the most underused guardrails in agentic workflows. Instead of checking specific examples, you define invariants that must hold for all inputs, and the framework generates hundreds of edge cases automatically.

**Hypothesis** (Python) is the mature leader — it integrates with pytest via `@given`, offers rich composable strategies, automatic shrinking to minimal failing cases, and stateful testing via `RuleBasedStateMachine`. A 2025 Anthropic research paper demonstrated LLM agents writing Hypothesis tests at scale, finding genuine bugs in NumPy and other major libraries. **HypoFuzz** (November 2025) adds coverage-guided fuzzing on top of Hypothesis. **fast-check** (TypeScript) is the equivalent — it adds unique features like **race condition detection** (shuffles async resolution to find concurrency bugs) and is used by Microsoft for TypeScript parser fuzzing.

**Design-by-contract** tools turn function signatures into runtime guardrails. **beartype** provides O(1) runtime type checking with near-zero overhead — decorate functions with `@beartype` and any type annotation mismatch raises an immediate, clear error. **icontract** offers full precondition/postcondition/invariant checking with an ecosystem that includes **icontract-hypothesis** (auto-generates test strategies from contracts) and **CrossHair** integration (symbolic execution via Z3 to find counterexamples without running code).

**Mutation testing** validates test quality itself. **mutmut** makes small changes to source code (replacing `>` with `>=`, `True` with `False`) and runs your test suite — surviving mutants reveal gaps. This is especially valuable for AI-generated tests, which research shows achieve only **~20% mutation scores** (meaning 80% of injected bugs slip through). Running mutmut periodically catches this.

---

## Snapshot testing, schema validation, and performance regression detection

**Snapshot testing** serves as change detection for outputs. **Syrupy** (Python, pytest plugin) captures computed values as serialized snapshots; tests fail when output changes unexpectedly. It supports JSON matching with path-type matchers for dynamic fields like timestamps. On the TypeScript side, Jest's `toMatchSnapshot` serves the same purpose. Snapshots are particularly effective as guardrails because they force explicit acknowledgment of behavioral changes — an AI agent modifying an API response format will trigger a snapshot failure that requires deliberate update.

**Schema validation tools** prevent breaking API and database changes deterministically. **Schemathesis** (used by Spotify, JetBrains, Capital One) reads your OpenAPI spec and auto-generates thousands of test cases using Hypothesis — testing for 500 errors, schema violations, and stateful bugs with zero configuration. **Spectral** (by Stoplight) lints OpenAPI/AsyncAPI specs against design standards. **Optic** diffs OpenAPI specs between versions to catch breaking changes. For protobuf, **Buf** is the industry standard — `buf breaking` detects removed fields and changed types.

**Performance regression detection** catches a class of bugs invisible to functional tests. **CodSpeed** uses CPU simulation (like Valgrind's callgrind) to achieve **<1% variance** in CI environments, detecting algorithmic regressions on every PR with differential flamegraphs. It integrates via `pytest-codspeed` (Python) and Vitest/Node.js harnesses. Ruff, Pydantic, and Node.js itself use CodSpeed. **pytest-testmon** complements this with test impact analysis — it tracks which tests exercise which code and runs only affected tests on changes, cutting CI time dramatically.

---

## How agentic coding tools integrate checks as feedback loops

The dominant pattern across all agentic coding tools is **generate → check → feed errors back → fix → repeat**. The differences lie in how sophisticated the integration is:

**Claude Code** has the most mature hooks system with **10+ lifecycle events** (PreToolUse, PostToolUse, Stop, SessionStart, etc.) and three hook types: shell commands, single-turn LLM evaluation, and multi-turn agent verification. Exit code 2 blocks an action and feeds the reason back to Claude. A practical pattern: `afterFileEdit` hooks run `ruff check` and `mypy` on every Python edit, feeding errors back immediately. The **Ralph Loop** pattern (community-developed) wraps Claude Code in a continuous loop where each iteration runs type checking → tests → linting → commit, refusing to exit until all pass.

**Cursor's agent mode** auto-detects linter errors after edits and attempts fixes. Its **Hooks system** (beta, v1.7) provides `afterFileEdit` and `stop` lifecycle events for custom check integration. YOLO mode creates a tight autonomous loop: run `tsc` → find errors → fix → repeat. **Aider** has first-class `--auto-lint` and `--auto-test` flags that present errors to the LLM for automatic correction. **SWE-agent** integrates a linter directly into its edit command — invalid edits are discarded and the agent retries.

Several key patterns have emerged from practitioners:

- **Progressive checking**: Run fast checks first (format → lint → type check → unit tests → integration tests → security scan). This catches the most common issues cheaply.
- **Diff-based checking**: Only validate changed files, not the entire codebase. Tools like Trunk's "hold-the-line" feature report only new issues.
- **Token-efficient output**: When tests pass, output one line. When they fail, output only error summaries. Verbose green output is noise for agents.
- **Memory from violations**: Save hook violations to workspace memory, include in next agent session context, and compliance improves over time.
- **Multi-agent validation**: One agent writes code, another reviews it, a third tests it. CodeRabbit and Qodo implement this with specialized review agents.

**MCP (Model Context Protocol)** is becoming the standard integration layer — donated to the Linux Foundation in December 2025, co-founded by Anthropic, Block, and OpenAI. Linters, test runners, and security scanners can be exposed as MCP tools that any agent discovers and invokes at runtime.

---

## The recommended guardrail stack for a Python+TypeScript monorepo

For a monorepo with a Python backend and TypeScript frontend using agentic coding, here is a prioritized stack organized by execution speed:

| Layer | Python | TypeScript | Speed |
|-------|--------|------------|-------|
| **Format** | `ruff format` | Biome or Prettier | <1s |
| **Lint** | `ruff check` (900+ rules) | Oxlint or Biome (451+ rules) | <2s |
| **Type check** | `ty` (beta) or mypy/pyright | `tsc --noEmit` | seconds |
| **Architecture** | `import-linter` | `dependency-cruiser` | seconds |
| **Dead code** | Vulture + deadcode | Knip | seconds |
| **Security (SAST)** | Semgrep (cross-language) | Semgrep + Socket.dev | seconds |
| **Custom rules** | Semgrep / ast-grep / LibCST | Semgrep / ast-grep | seconds |
| **Type coverage** | — | `type-coverage --at-least 95` | seconds |
| **Complexity gates** | `xenon` (wraps radon) | SonarQube / ESLint complexity | seconds |
| **Dependency vulns** | `pip-audit` | `npm audit` + Socket.dev | seconds |
| **Snapshot tests** | Syrupy | Jest snapshots | seconds-minutes |
| **Property tests** | Hypothesis | fast-check | minutes |
| **Schema validation** | Schemathesis (from OpenAPI) | Spectral + Optic | minutes |
| **Contract tests** | Pact | Pact | minutes |
| **Performance** | CodSpeed (pytest-codspeed) | CodSpeed (Vitest) | minutes |
| **Mutation testing** | mutmut | — | batch (slow) |

Wire fast checks (format through dead code) into your agent's `afterFileEdit` hooks for immediate feedback. Run slower checks (property tests, schema validation, mutation testing) as CI gates on PR. Use **Lefthook** or **pre-commit** for local git hooks, and **Nx** or **Turborepo** for affected-only task execution in CI. Aggregate results using SARIF format and **Danger.js** for unified PR reporting.

## Conclusion

The most impactful additions to a unit-test + type-check + complexity baseline are **architectural boundary enforcement** (which prevents structural decay that tests don't catch), **Semgrep custom rules** (which encode project-specific invariants across both languages), and **property-based testing** (which generates edge cases that hand-written tests miss). The agentic coding ecosystem has converged on a clear pattern: deterministic tools should do deterministic work — never prompt an LLM to follow a style guide when a linter can enforce it. The tools exist; the leverage is in wiring them into your agent's feedback loop with progressive checking (fast first, slow later) and token-efficient error summaries. The frontier is moving toward spec-driven development where machine-readable specifications serve as enforceable contracts, and formal verification where proof checkers validate AI-generated code — but the practical wins today come from the concrete tools above.
