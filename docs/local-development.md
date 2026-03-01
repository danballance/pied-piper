# Local Development

Running the Python and TypeScript CLI tools locally from the worktree before publishing to PyPI/npm.

Both tools live in the worktree at:
`/home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/`

---

## Python tool

### Option 1: `uvx --from` (simulates end-user experience)

```bash
# From any project directory you want to check:
uvx --python 3.12 --from /home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/py pied-piper check fast
uvx --python 3.12 --from /home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/py pied-piper check full
uvx --python 3.12 --from /home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/py pied-piper fix
```

`uvx --python 3.12 --from <local-path>` creates a temporary venv, installs the package with all deps (ruff, ty, bandit, etc.), and runs the `pied-piper` console script.

### Option 2: `uv run` (fastest for iterating)

```bash
# Install deps once:
cd /home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/py
uv sync

# Then from any project directory:
uv run --project /home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/py pied-piper check fast
```

### Option 3: `uv tool install` (permanent install)

```bash
uv tool install /home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/py

# Now available everywhere as `pied-piper` or `piper`:
pied-piper check fast
piper check fast

# Uninstall when done:
uv tool uninstall pied-piper
```

---

## TypeScript tool

### Option 1: `npx tsx` (no build step needed)

```bash
# Install deps once:
cd /home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/ts && npm install

# Then from any project directory:
npx --prefix /home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/ts \
  tsx /home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/ts/src/cli.ts check fast
```

### Option 2: `node` directly (build once, simpler invocation)

```bash
# Build once:
cd /home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/ts
npm install && npm run build

# Then from any project directory:
node /home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/ts/dist/cli.js check fast
```

### Option 3: `npm link` (permanent install)

```bash
cd /home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/ts
npm run build && npm link

# Now available everywhere as `pied-piper` or `piper`:
pied-piper check fast
piper check fast

# Unlink when done:
npm unlink -g pied-piper
```

---

## Available commands

| Command | Description |
|---------|-------------|
| `check fast` | Format + lint + type check |
| `check full` | Full checks (architecture, dead code, type coverage, etc.) |
| `check <name>` | Run a single check (e.g. `format`, `type`, `security`) |
| `fix` | Auto-fix formatting and lint issues |
| `version` | Print version |

---

## Claude Code hook configuration

To test as hooks using full paths:

```json
{
  "hooks": {
    "PostToolUse": [{ "matcher": "Edit|Write", "hooks": [
      { "type": "command", "command": "uv run --project /home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/py pied-piper check fast" },
      { "type": "command", "command": "node /home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/ts/dist/cli.js check fast" }
    ]}],
    "Stop": [{ "hooks": [
      { "type": "command", "command": "uv run --project /home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/py pied-piper check full" },
      { "type": "command", "command": "node /home/anoni/Code/ai/pied-piper/.worktrees/pivot-uvx-npx/ts/dist/cli.js check full" }
    ]}]
  }
}
```

With permanent installs (`uv tool install` / `npm link`):

```json
{
  "hooks": {
    "PostToolUse": [{ "matcher": "Edit|Write", "hooks": [
      { "type": "command", "command": "pied-piper check fast" }
    ]}],
    "Stop": [{ "hooks": [
      { "type": "command", "command": "pied-piper check full" }
    ]}]
  }
}
```

Note: with permanent installs, only one `pied-piper` binary can be on PATH (the last installed wins). Use full paths in hooks if you need both.
