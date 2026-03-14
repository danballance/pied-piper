# Local Development

Running the Python and TypeScript CLI tools locally before publishing to PyPI/npm.

> `<repo>` below means the root of your cloned repository.

Both tools live at `py/` and `ts/` in the repo root.

---

## Python tool

### Option 1: `uvx --from` (simulates end-user experience)

```bash
# From any project directory you want to check:
uvx --python 3.12 --from <repo>/py piper-py check fast
uvx --python 3.12 --from <repo>/py piper-py check full
uvx --python 3.12 --from <repo>/py piper-py format
uvx --python 3.12 --from <repo>/py piper-py fix
```

`uvx --python 3.12 --from <local-path>` creates a temporary venv, installs the package with all deps (ruff, ty, bandit, etc.), and runs the `piper-py` console script.

### Option 2: `uv run` (fastest for iterating)

```bash
# Install deps once:
cd <repo>/py
uv sync

# Then from any project directory:
uv run --project <repo>/py piper-py check fast
```

### Option 3: `uv tool install` (permanent install)

```bash
uv tool install <repo>/py

# Now available everywhere as `piper-py`:
piper-py check fast

# Uninstall when done:
uv tool uninstall piper-py
```

---

## TypeScript tool

### Option 1: `npx tsx` (no build step needed)

```bash
# Install deps once:
cd <repo>/ts && npm install

# Then from any project directory:
npx --prefix <repo>/ts tsx <repo>/ts/src/cli.ts check fast
```

### Option 2: `node` directly (build once, simpler invocation)

```bash
# Build once:
cd <repo>/ts
npm install && npm run build

# Then from any project directory:
node <repo>/ts/dist/cli.js check fast
```

### Option 3: `npm link` (permanent install)

```bash
cd <repo>/ts
npm run build && npm link

# Now available everywhere as `piper-ts`:
piper-ts check fast

# Unlink when done:
npm unlink -g piper-ts
```

---

## Available commands

| Command | Description |
|---------|-------------|
| `init` | Generate `.piper/piper.toml` config |
| `check fast` | Format + lint + type check |
| `check full` | Full checks (architecture, dead code, type coverage, etc.) |
| `check <name>` | Run a single check (e.g. `format`, `type`, `security`) |
| `test unit` | Unit tests |
| `test full` | Unit + integration/contract tests |
| `test e2e` | End-to-end tests |
| `test <name>` | Run a single test (e.g. `unit`, `contract`) |
| `format` | Auto-fix formatting |
| `fix` | Auto-fix lint issues |
| `version` | Print version |

> **Note:** Run `piper-py init` / `piper-ts init` first to generate `.piper/piper.toml` before using any other command.

---

## Claude Code hook configuration

To test as hooks using full paths:

```json
{
  "hooks": {
    "PostToolUse": [{ "matcher": "Edit|Write", "hooks": [
      { "type": "command", "command": "uv run --project <repo>/py piper-py check fast" },
      { "type": "command", "command": "node <repo>/ts/dist/cli.js check fast" }
    ]}],
    "Stop": [{ "hooks": [
      { "type": "command", "command": "uv run --project <repo>/py piper-py check full" },
      { "type": "command", "command": "node <repo>/ts/dist/cli.js check full" }
    ]}]
  }
}
```

With permanent installs (`uv tool install` / `npm link`):

```json
{
  "hooks": {
    "PostToolUse": [{ "matcher": "Edit|Write", "hooks": [
      { "type": "command", "command": "piper-py check fast" },
      { "type": "command", "command": "piper-ts check fast" }
    ]}],
    "Stop": [{ "hooks": [
      { "type": "command", "command": "piper-py check full" },
      { "type": "command", "command": "piper-ts check full" }
    ]}]
  }
}
```

Both tools can be installed permanently without conflict — piper-py and piper-ts use distinct binary names.
