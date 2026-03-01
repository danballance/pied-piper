# Pied Piper

Code guardrails for agentic coding workflows. Runs formatting, linting, type checking, and more as Claude Code hooks -- giving the agent immediate feedback when checks fail.

```bash
# Run directly -- no install needed
uvx pied-piper check fast    # Python checks
npx pied-piper check fast    # TypeScript checks
```

Two packages, one per language ecosystem. Add hooks for the languages you use.

See **[docs/README.md](docs/README.md)** for setup, hook configuration, and the full check reference.
