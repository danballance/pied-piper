> **Status: IMPLEMENTED** (2026-02-28)
>
> Design implemented as specified. See the implementation plan for task-by-task details.

# Pied Piper: Docker Packaging Design

## Problem

The current guardrails orchestrator requires target projects to have:

1. Python and Node.js virtual environments with lock files
2. ~20 individual tools installed via pip and npm
3. Multiple config files scattered across the project (biome.json, .semgrep.yml, sgconfig.yml, pyproject.toml tool sections, etc.)
4. A Justfile exposing all internal tool names and orchestration logic — a large attack surface for LLM prompt injection

## Solution

Package all tools, configs, and orchestration into a single OCI (Docker) image distributed via GHCR. Target projects need only a shell wrapper script on `$PATH` and a Claude Code hooks file.

## Architecture

```
┌─────────────────────────────────────┐
│  User / Claude Code hooks           │
│  $ pied-piper check-fast .          │  ← shell wrapper script on $PATH
├─────────────────────────────────────┤
│  Docker runtime                     │
│  docker run --rm --network none     │
│  --read-only --cap-drop ALL         │  ← security boundary
│  -v "$(pwd):/work:ro"              │
├─────────────────────────────────────┤
│  OCI Image (ghcr.io/org/pied-piper) │
│  ┌───────────────────────────────┐  │
│  │ Entrypoint: pied-piper CLI    │  │  ← routes subcommands
│  │ ┌───────────────────────────┐ │  │
│  │ │ Justfile orchestration    │ │  │  ← just recipes (hidden)
│  │ │ ┌─────────────────────┐  │ │  │
│  │ │ │ ruff, ty, biome,    │  │ │  │
│  │ │ │ bandit, semgrep,    │  │ │  │  ← individual tools (hidden)
│  │ │ │ knip, tsc, etc.     │  │ │  │
│  │ │ └─────────────────────┘  │ │  │
│  │ └───────────────────────────┘ │  │
│  │ Config files (baked in)       │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

The agent only sees `pied-piper` and its structured output. Internal tool names, config files, Justfile recipes, and orchestration logic are never exposed.

## CLI Interface

Five commands, no more:

```
pied-piper check-fast [path]    # format + lint + type check (~5s)
pied-piper check-full [path]    # + architecture + security + dead code (~15s)
pied-piper check-pr [path]      # + property tests (minutes)
pied-piper fix [path]           # auto-fix formatting and lint issues
pied-piper version              # print version
```

### Output Format

Token-efficient, structured by generic category:

```
OK   format
OK   lint
FAIL typecheck
  src/app.ts:14:5 - error TS2322: Type 'string' not assignable to 'number'
  Found 1 error.
```

Categories: `format`, `lint`, `typecheck`, `security`, `architecture`, `deadcode`, `complexity`. Individual tool names (ruff, biome, bandit) are never shown.

Exit codes: `0` = all pass, `2` = check failed (agent self-corrects).

## Wrapper Script

Users install a shell wrapper script:

```bash
#!/usr/bin/env sh
set -e

IMAGE="${PIED_PIPER_IMAGE:-ghcr.io/your-org/pied-piper:latest}"

# fix command needs write access
if [ "$1" = "fix" ]; then
  MOUNT_FLAG="rw"
  USER_FLAG="--user $(id -u):$(id -g)"
else
  MOUNT_FLAG="ro"
  USER_FLAG=""
fi

# Auto-detect and mount project dependencies (improves type-check accuracy)
EXTRA_MOUNTS=""
[ -d .venv ] && EXTRA_MOUNTS="$EXTRA_MOUNTS -v $(pwd)/.venv:/work/.venv:ro"
[ -d node_modules ] && EXTRA_MOUNTS="$EXTRA_MOUNTS -v $(pwd)/node_modules:/work/node_modules:ro"

exec docker run --rm \
  --network none \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --tmpfs /tmp:rw,noexec,size=200m \
  $USER_FLAG \
  -v "$(pwd):/work:${MOUNT_FLAG}" \
  $EXTRA_MOUNTS \
  -w /work \
  "$IMAGE" "$@"
```

When `.venv` or `node_modules` exist in the project, they are mounted read-only into the container. This enables full accuracy for type checkers (ty, tsc) and architecture tools (import-linter) that need the project's dependency tree. Tools gracefully skip or degrade when these directories aren't available.

## Docker Image Build

Multi-stage Dockerfile:

```dockerfile
# Stage 1: Python tools
FROM python:3.12-slim AS python-tools
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen

# Stage 2: Node tools
FROM node:20-slim AS node-tools
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Stage 3: Final image
FROM python:3.12-slim
COPY --from=python-tools /venv /venv
COPY --from=node-tools /node_modules /node_modules
COPY --from=node-tools /usr/local/bin/node /usr/local/bin/node
# just binary (pre-built)
COPY --from=just-builder /usr/bin/just /usr/bin/just
# Baked-in configs
COPY biome.json .semgrep.yml sgconfig.yml pyproject.toml /etc/pied-piper/
# Orchestration (hidden from user)
COPY Justfile scripts/ /opt/pied-piper/
# Entrypoint
COPY entrypoint.sh /usr/local/bin/pied-piper
RUN chmod +x /usr/local/bin/pied-piper
ENTRYPOINT ["pied-piper"]
CMD ["--help"]
```

Estimated image size: ~200-400 MB compressed. Build for `linux/amd64` + `linux/arm64`.

Published to `ghcr.io` via GitHub Actions on tag push. Tags: `:latest`, `:1.0.0`, `:1.0`, `:1`.

## Security Model

Four layers of defense:

### Layer 1: Opaque Interface

The agent knows only `pied-piper check-fast` and sees generic category names. It cannot be tricked into running `just py-security --disable-all` because it doesn't know those commands exist.

### Layer 2: Container Isolation

- `--network none` — no data exfiltration
- `--read-only` — container filesystem is immutable
- `--cap-drop ALL` — no Linux capabilities
- `--security-opt no-new-privileges` — no setuid escalation
- `-v ... :ro` — source code is read-only (except `fix`)
- `--tmpfs /tmp:rw,noexec` — temp space can't execute binaries

### Layer 3: Environment Stripping

The entrypoint strips sensitive environment variables before invoking tools:

```bash
unset GITHUB_TOKEN GITLAB_TOKEN NPM_TOKEN AWS_SECRET_ACCESS_KEY
# Pattern-based stripping for *_TOKEN, *_SECRET, *_PASSWORD
for var in $(env | grep -iE '_(TOKEN|SECRET|PASSWORD|KEY|CREDENTIAL)=' | cut -d= -f1); do
  unset "$var"
done
```

### Layer 4: Supply Chain Pinning

- `uv.lock` + `package-lock.json` pin exact versions inside the image
- `npm ci --ignore-scripts` prevents postinstall attacks
- `npm audit` runs in the image build CI pipeline
- Image tagged with content hash for verification

## Target Project Impact

### Before (current)

```
project/
├── Justfile
├── pyproject.toml          (tool config sections)
├── biome.json
├── tsconfig.json
├── .semgrep.yml
├── sgconfig.yml
├── package.json
├── package-lock.json
├── uv.lock
├── scripts/run-check.sh
├── rules/
└── .claude/settings.local.json
```

### After (Docker-wrapped)

```
project/
└── .claude/settings.local.json
```

One file. Everything else lives inside the Docker image.

### Claude Code Hook Configuration

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "command": "pied-piper check-fast"
    }],
    "Stop": [{
      "command": "pied-piper check-full"
    }]
  }
}
```

## Installation

```bash
# Option 1: Download wrapper script
curl -sSL https://raw.githubusercontent.com/org/pied-piper/main/install.sh | sh

# Option 2: Nix/devenv (wrapper script provided by devenv.nix)
# Nothing to do — already on $PATH

# Option 3: CI — use Docker image directly
docker run --rm -v "$(pwd):/work:ro" ghcr.io/org/pied-piper check-full .
```

## Performance

- Linux: ~1s overhead per invocation (container startup). Acceptable for guardrail checks.
- macOS: ~2-5s overhead (Docker Desktop VM + bind mount I/O). Tolerable, not optimized for.
- CI: Negligible — image is pre-pulled, checks run once.

If startup overhead becomes a problem, a sidecar pattern (`docker exec` on a long-running container) can be added later without changing the CLI interface.

## Decisions and Trade-offs

| Decision | Rationale |
|----------|-----------|
| Docker over AppImage/Nix bundle | Only format that bundles both Python + Node runtimes as a single cross-platform artifact |
| Baked-in configs over project configs | Eliminates config sprawl; opinionated defaults are a feature |
| Generic category names in output | Hides internal tools from the agent; reduces prompt injection surface |
| `--network none` always | Linters never need network access; prevents exfiltration. pip-audit dropped because it requires network. |
| Auto-mount .venv and node_modules | Improves type-check and architecture tool accuracy without requiring user setup |
| `npm ci --ignore-scripts` | Prevents npm postinstall supply chain attacks at build time |
| Linux-first, macOS acceptable | Docker I/O on macOS is slower but tolerable; optimizing for it adds complexity |
| Shell wrapper over compiled binary | Simpler to distribute, inspect, and modify |

## Experimentally Verified (2026-02-28)

All tools were tested inside a Docker container with `--network none --read-only --cap-drop ALL`. Results:

| Tool | Works? | Workaround needed |
|------|--------|-------------------|
| ruff | Yes | `--cache-dir /tmp/ruff-cache` (default cache fails on read-only mount) |
| vulture | Yes | None |
| bandit | Yes | None |
| import-linter | Yes | `--no-cache` flag (cache write fails on read-only mount) |
| semgrep | Yes | `--metrics=off` and local rules file (no network needed) |
| ty | Yes | Degrades gracefully without .venv (reports unresolved-import for external packages) |
| tsc | Yes | Needs mounted node_modules for external type resolution. Baked-in tsconfig with absolute `/work` paths works. |
| biome | Yes (expected) | `--config-path /etc/pied-piper` |
| xenon | Yes (expected) | None (CLI flags only) |
| ast-grep | Yes (expected) | `--config /etc/pied-piper/sgconfig.yml` |
| **pip-audit** | **No** | **Requires network to query PyPI/OSV vulnerability database. Dropped from container.** |
