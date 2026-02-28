> **Status: COMPLETED** (2026-02-28)
>
> All 12 tasks implemented. Docker image builds and passes all checks with full security lockdown.
> See `Dockerfile`, `bin/pied-piper`, `docker/`, `install.sh`, and `.github/workflows/docker-publish.yml`.

# Docker Packaging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Package all guardrail tools into a single OCI image so target projects need zero config files, zero venvs, and zero tool installations.

**Architecture:** A shell wrapper script (`bin/pied-piper`) invokes `docker run` with security flags and auto-mounts project dependencies when available. Inside the container, an entrypoint routes subcommands to a container-specific Justfile. Tools, configs, and orchestration are baked into the image. Output uses generic category names (`py:format`, `ts:lint`) — never tool names.

**Tech Stack:** Docker multi-stage build, shell scripts, Just, Python 3.12 + Node.js 20 (inside container), GHCR for publishing.

**Design doc:** `docs/plans/2026-02-28-docker-packaging-design.md`

---

### Key Findings from Verification (2026-02-28)

All tools were tested inside Docker with `--network none --read-only --cap-drop ALL`:

- **pip-audit dropped** — requires network to query vulnerability databases. Incompatible with `--network none`.
- **ruff** needs `--cache-dir /tmp/ruff-cache` (default cache location fails with read-only mount)
- **import-linter** needs `--no-cache` flag (cache write fails with read-only filesystem)
- **semgrep** needs `--metrics=off` (tries to phone home for telemetry)
- **tsc** works with a dynamically generated tsconfig in `/tmp/` using absolute `/work` paths
- **ty** degrades gracefully: reports `unresolved-import` warnings for external packages when `.venv` is not mounted, but still catches type errors
- **Auto-mounting `.venv` and `node_modules`** when they exist in the project gives full accuracy for ty, tsc, import-linter, and other dependency-aware tools

---

### Task 1: Create .dockerignore and docker/pyproject.toml

The existing Justfile, pyproject.toml, package.json, and all config files remain untouched. The Docker image is a parallel distribution — it uses its own copy of pyproject.toml with pip-audit excluded (since the container runs with `--network none`).

**Files:**
- Create: `.dockerignore`
- Create: `docker/pyproject.toml` — copy of root pyproject.toml with pip-audit removed

**Step 1: Create .dockerignore**

```
# Exclude from Docker build context
.devenv/
.direnv/
.venv/
node_modules/
.pycache/
__pycache__/
.git/
.env
.import_linter_cache/
.semgrep/
.mutmut-cache/
docs/
.claude/
```

**Step 2: Create docker/pyproject.toml**

Copy from root `pyproject.toml` but remove `pip-audit` from the dev dependency group (it requires network access, incompatible with `--network none`). Keep everything else identical.

**Step 3: Commit**

```bash
git add .dockerignore docker/pyproject.toml
git commit -m "chore: add .dockerignore and container-specific pyproject.toml"
```

---

### Task 2: Create docker/entrypoint.sh

**Files:**
- Create: `docker/entrypoint.sh`

**Step 1: Create the entrypoint**

This is the CLI inside the container. It strips environment variables and routes subcommands.

```bash
#!/usr/bin/env bash
set -euo pipefail

# -- Layer 3: Environment stripping --
# Strip known sensitive variables
unset GITHUB_TOKEN GITLAB_TOKEN NPM_TOKEN DOCKER_PASSWORD \
      AWS_SECRET_ACCESS_KEY AWS_ACCESS_KEY_ID \
      AZURE_CLIENT_SECRET GCP_SERVICE_ACCOUNT_KEY 2>/dev/null || true

# Strip pattern-matched variables (*_TOKEN, *_SECRET, *_PASSWORD, *_KEY, *_CREDENTIAL)
for var in $(env | grep -iE '_(TOKEN|SECRET|PASSWORD|KEY|CREDENTIAL|AUTH)=' | cut -d= -f1); do
  unset "$var" 2>/dev/null || true
done

VERSION="0.1.0"
JUSTFILE="/opt/pied-piper/Justfile"

case "${1:-}" in
  check-fast|check-full|check-pr|fix)
    exec just --justfile "$JUSTFILE" --working-directory /work "$1"
    ;;
  version|--version|-v)
    echo "pied-piper $VERSION"
    ;;
  --help|-h|"")
    cat <<'HELP'
pied-piper - guardrails for agentic coding

Usage: pied-piper <command>

Commands:
  check-fast    Format + lint + type check (~5s)
  check-full    + security + dead code + complexity (~15s)
  check-pr      Full check suite
  fix           Auto-fix formatting and lint issues
  version       Print version
HELP
    ;;
  *)
    echo "Unknown command: $1" >&2
    echo "Run 'pied-piper --help' for usage" >&2
    exit 1
    ;;
esac
```

**Step 2: Make executable**

Run: `chmod +x docker/entrypoint.sh`

**Step 3: Commit**

```bash
git add docker/entrypoint.sh
git commit -m "feat: add container entrypoint with env stripping and command routing"
```

---

### Task 3: Create docker/Justfile

**Files:**
- Create: `docker/Justfile`

Container-specific Justfile. Key differences from the development Justfile:
- Uses category names (`py:format`) not tool names (`ruff format`)
- References configs from `/etc/pied-piper/`
- Invokes tools directly (tools are on `$PATH` inside the container, no `uv run`/`npx`)
- Includes verified cache/temp workarounds from experiments
- Gracefully skips checks when source files or dependencies aren't found

**Step 1: Create the container Justfile**

```justfile
# Pied Piper Container Justfile
# Invoked by docker/entrypoint.sh — never seen by the user or agent.

config := "/etc/pied-piper"
run_check := "/opt/pied-piper/scripts/run-check.sh"

# -- Python checks --

py-format:
    {{run_check}} "py:format" ruff format --check --cache-dir /tmp/ruff-cache --config {{config}}/pyproject.toml .

py-lint:
    {{run_check}} "py:lint" ruff check --cache-dir /tmp/ruff-cache --config {{config}}/pyproject.toml .

py-type:
    {{run_check}} "py:typecheck" ty check .

py-arch:
    {{run_check}} "py:architecture" lint-imports --config {{config}}/pyproject.toml --no-cache

py-deadcode:
    {{run_check}} "py:deadcode" vulture . --min-confidence 80

py-security:
    {{run_check}} "py:security" bandit -r . -q -ll

py-complexity:
    {{run_check}} "py:complexity" xenon --max-absolute B --max-modules A --max-average A .

# -- TypeScript checks --

ts-format:
    #!/usr/bin/env bash
    if ! find . -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' 2>/dev/null | head -1 | grep -q .; then
        echo "SKIP ts:format (no JS/TS source files found)"
        exit 0
    fi
    {{run_check}} "ts:format" biome format --config-path {{config}} .

ts-lint:
    #!/usr/bin/env bash
    if ! find . -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' 2>/dev/null | head -1 | grep -q .; then
        echo "SKIP ts:lint (no JS/TS source files found)"
        exit 0
    fi
    {{run_check}} "ts:lint" biome lint --config-path {{config}} .

ts-type:
    #!/usr/bin/env bash
    if ! find . -name '*.ts' 2>/dev/null | head -1 | grep -q .; then
        echo "SKIP ts:typecheck (no .ts source files found)"
        exit 0
    fi
    # Generate temp tsconfig with absolute paths for /work mount
    cat > /tmp/tsconfig.json <<'TSCONF'
    {
      "compilerOptions": {
        "target": "ES2022", "module": "Node16", "moduleResolution": "Node16",
        "strict": true, "noEmit": true, "skipLibCheck": true, "esModuleInterop": true
      },
      "include": ["/work/**/*.ts", "/work/**/*.tsx"],
      "exclude": ["/work/node_modules", "/work/dist", "/work/build", "/work/.next"]
    }
    TSCONF
    {{run_check}} "ts:typecheck" tsc -p /tmp/tsconfig.json

# -- Cross-language checks --

x-semgrep:
    {{run_check}} "x:security" semgrep scan --config {{config}}/.semgrep.yml --quiet --error --metrics=off .

x-astgrep:
    {{run_check}} "x:lint" ast-grep scan --config {{config}}/sgconfig.yml

# -- Composite recipes --

check-fast: py-format py-lint py-type ts-format ts-lint ts-type

check-full: check-fast py-arch py-deadcode py-security py-complexity x-semgrep x-astgrep

check-pr: check-full

# -- Fix recipes --

fix:
    #!/usr/bin/env bash
    ruff format --cache-dir /tmp/ruff-cache --config {{config}}/pyproject.toml .
    ruff check --cache-dir /tmp/ruff-cache --fix --config {{config}}/pyproject.toml . || true
    if find . -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' 2>/dev/null | head -1 | grep -q .; then
        biome format --write --config-path {{config}} .
        biome lint --write --config-path {{config}} . || true
    fi
    echo "OK fix"
```

**Step 2: Verify syntax**

Run: `just --justfile docker/Justfile --list`
Expected: Recipe list shown.

**Step 3: Commit**

```bash
git add docker/Justfile
git commit -m "feat: add container Justfile with category names and verified workarounds"
```

---

### Task 4: Create Dockerfile

**Files:**
- Create: `Dockerfile`

**Step 1: Create the multi-stage Dockerfile**

```dockerfile
# Stage 1: Install Python tools
FROM python:3.12-slim AS python-builder
WORKDIR /build
RUN pip install --no-cache-dir uv
COPY docker/pyproject.toml pyproject.toml
COPY uv.lock ./
# Create venv and install dev dependencies (uses docker/pyproject.toml which excludes pip-audit)
RUN uv venv /opt/venv && \
    VIRTUAL_ENV=/opt/venv uv sync --frozen --no-install-project

# Stage 2: Install Node tools
FROM node:20-slim AS node-builder
WORKDIR /build
COPY package.json package-lock.json ./
# --ignore-scripts prevents postinstall supply chain attacks
# Then verify biome and ast-grep platform binaries are available
RUN npm ci --ignore-scripts && \
    npx @biomejs/biome --version && \
    npx @ast-grep/cli --version

# Stage 3: Get just binary
FROM debian:bookworm-slim AS just-builder
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && \
    curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin && \
    rm -rf /var/lib/apt/lists/*

# Stage 4: Final image
FROM python:3.12-slim

# Install Node.js runtime (needed for tsc, knip, dependency-cruiser, type-coverage)
COPY --from=node-builder /usr/local/bin/node /usr/local/bin/node

# Copy just binary
COPY --from=just-builder /usr/local/bin/just /usr/local/bin/just

# Copy Python tools (venv)
COPY --from=python-builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy Node tools (node_modules)
COPY --from=node-builder /build/node_modules /opt/node_modules
ENV PATH="/opt/node_modules/.bin:$PATH"
ENV NODE_PATH="/opt/node_modules"

# Copy baked-in configs
COPY biome.json .semgrep.yml sgconfig.yml pyproject.toml /etc/pied-piper/
COPY rules/ /etc/pied-piper/rules/

# Copy orchestration
COPY docker/Justfile /opt/pied-piper/Justfile
COPY scripts/run-check.sh /opt/pied-piper/scripts/run-check.sh
RUN chmod +x /opt/pied-piper/scripts/run-check.sh

# Copy entrypoint
COPY docker/entrypoint.sh /usr/local/bin/pied-piper
RUN chmod +x /usr/local/bin/pied-piper

# Create non-root user
RUN groupadd --gid 1000 piper && \
    useradd --uid 1000 --gid piper --no-create-home piper
USER piper

WORKDIR /work
ENTRYPOINT ["pied-piper"]
CMD ["--help"]
```

**Step 2: Commit**

```bash
git add Dockerfile
git commit -m "feat: add multi-stage Dockerfile for pied-piper container image"
```

---

### Task 5: Build the Docker image

**Step 1: Build the image**

Run: `docker build -t pied-piper:dev .`
Expected: Multi-stage build completes. Watch for errors with `--ignore-scripts` for biome/ast-grep. If their platform binaries aren't available, try removing `--ignore-scripts` for just those packages or installing them differently.

**Step 2: Check image size**

Run: `docker images pied-piper:dev`
Expected: Image size displayed. Target: under 500 MB.

**Step 3: Verify tools are on PATH**

Run: `docker run --rm pied-piper:dev version`
Expected: `pied-piper 0.1.0`

Run: `docker run --rm --entrypoint bash pied-piper:dev -c "ruff --version && biome --version && just --version && node --version && ty --version && bandit --version && vulture --version && semgrep --version"`
Expected: Version strings for all tools.

---

### Task 6: Verify check-fast with full security lockdown

**Step 1: Run check-fast against pied-piper's own code**

Run:
```bash
docker run --rm \
  --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges \
  --tmpfs /tmp:rw,noexec,size=200m \
  -v "$(pwd):/work:ro" \
  -w /work \
  pied-piper:dev check-fast
```

Expected output (approximately):
```
OK   py:format
OK   py:lint
OK   py:typecheck
SKIP ts:format (no JS/TS source files found)
SKIP ts:lint (no JS/TS source files found)
SKIP ts:typecheck (no .ts source files found)
```

Exit code: `0`.

**Step 2: Introduce a lint error and verify detection**

```bash
echo 'x = 1' > /tmp/test_lint.py
docker run --rm --network none --read-only --tmpfs /tmp:rw,noexec \
  -v "/tmp/test_lint.py:/work/test_lint.py:ro" \
  pied-piper:dev check-fast
echo "Exit: $?"
rm /tmp/test_lint.py
```

Expected: `FAIL py:lint` with error details. Exit code `2`.

**Step 3: Fix any issues**

If any checks fail due to container config (cache dirs, paths, etc.), fix in docker/Justfile or Dockerfile and rebuild.

---

### Task 7: Verify check-full and security features

**Step 1: Run check-full**

Run:
```bash
docker run --rm \
  --network none --read-only --cap-drop ALL \
  --tmpfs /tmp:rw,noexec,size=200m \
  -v "$(pwd):/work:ro" -w /work \
  pied-piper:dev check-full
```

Expected: All check-fast output plus architecture, security, deadcode, complexity, semgrep, ast-grep results.

**Step 2: Verify env var stripping**

Run:
```bash
docker run --rm \
  -e GITHUB_TOKEN=secret123 -e MY_SECRET_KEY=abc \
  -v "$(pwd):/work:ro" -w /work \
  pied-piper:dev check-fast
```

Expected: Normal check output. No error about tokens. To verify stripping, temporarily add `env | grep -i token` to entrypoint.sh and confirm nothing is printed.

**Step 3: Verify auto-mount of .venv improves ty accuracy**

Run ty WITHOUT .venv mounted:
```bash
docker run --rm --network none --read-only --tmpfs /tmp:rw,noexec \
  -v "$(pwd):/work:ro" -w /work \
  pied-piper:dev check-fast 2>&1 | grep -i "typecheck\|unresolved"
```

Run ty WITH .venv mounted:
```bash
docker run --rm --network none --read-only --tmpfs /tmp:rw,noexec \
  -v "$(pwd):/work:ro" -v "$(pwd)/.venv:/work/.venv:ro" -w /work \
  pied-piper:dev check-fast 2>&1 | grep -i "typecheck\|unresolved"
```

Expected: Fewer or no unresolved-import warnings with .venv mounted.

---

### Task 8: Create bin/pied-piper wrapper script

**Files:**
- Create: `bin/pied-piper`

**Step 1: Create the wrapper with auto-mount**

```bash
#!/usr/bin/env sh
set -e

IMAGE="${PIED_PIPER_IMAGE:-ghcr.io/your-org/pied-piper:latest}"

# fix command needs write access to modify files
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

**Step 2: Make executable**

Run: `chmod +x bin/pied-piper`

**Step 3: Commit**

```bash
git add bin/pied-piper
git commit -m "feat: add pied-piper wrapper with auto-mount of .venv and node_modules"
```

---

### Task 9: Create install.sh

**Files:**
- Create: `install.sh`

**Step 1: Create the installer**

```bash
#!/usr/bin/env sh
set -e

INSTALL_DIR="${PIED_PIPER_INSTALL_DIR:-/usr/local/bin}"
REPO="your-org/pied-piper"
BRANCH="main"
SCRIPT_URL="https://raw.githubusercontent.com/${REPO}/${BRANCH}/bin/pied-piper"

echo "Installing pied-piper to ${INSTALL_DIR}..."

# Download wrapper script
if command -v curl >/dev/null 2>&1; then
  curl -sSL "$SCRIPT_URL" -o "${INSTALL_DIR}/pied-piper"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "${INSTALL_DIR}/pied-piper" "$SCRIPT_URL"
else
  echo "Error: curl or wget required" >&2
  exit 1
fi

chmod +x "${INSTALL_DIR}/pied-piper"

# Pull the Docker image
IMAGE="${PIED_PIPER_IMAGE:-ghcr.io/${REPO}:latest}"
echo "Pulling Docker image ${IMAGE}..."
docker pull "$IMAGE"

echo ""
echo "pied-piper installed successfully!"
echo "Run 'pied-piper --help' to get started."
```

**Step 2: Make executable and commit**

```bash
chmod +x install.sh
git add install.sh
git commit -m "feat: add install.sh for curl|sh distribution"
```

---

### Task 10: End-to-end test with wrapper script

**Step 1: Test wrapper against local image**

Run: `PIED_PIPER_IMAGE=pied-piper:dev bin/pied-piper check-fast`
Expected: Same output as Task 6. The wrapper invokes Docker with all security flags.

**Step 2: Test fix command (needs write mount)**

```bash
mkdir -p /tmp/pp-test && echo 'x=1' > /tmp/pp-test/test.py
cd /tmp/pp-test && PIED_PIPER_IMAGE=pied-piper:dev /path/to/pied-piper/bin/pied-piper fix
cat test.py
rm -rf /tmp/pp-test
```

Expected: `test.py` reformatted by ruff (e.g., `x = 1` with spaces).

**Step 3: Test help, version, and error handling**

```bash
PIED_PIPER_IMAGE=pied-piper:dev bin/pied-piper --help
PIED_PIPER_IMAGE=pied-piper:dev bin/pied-piper version
PIED_PIPER_IMAGE=pied-piper:dev bin/pied-piper foobar  # should exit 1
```

---

### Task 11: Create GitHub Actions workflow

**Files:**
- Create: `.github/workflows/docker-publish.yml`

**Step 1: Create the workflow**

```yaml
name: Build and publish Docker image

on:
  push:
    tags:
      - 'v*'
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract version from tag
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=semver,pattern={{major}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          platforms: linux/amd64,linux/arm64
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Test image
        if: github.event_name == 'pull_request'
        run: |
          docker build -t pied-piper:test .
          docker run --rm pied-piper:test version
          docker run --rm --network none --read-only --tmpfs /tmp:rw,noexec \
            -v "$(pwd):/work:ro" -w /work pied-piper:test check-fast
```

**Step 2: Commit**

```bash
mkdir -p .github/workflows
git add .github/workflows/docker-publish.yml
git commit -m "ci: add GitHub Actions workflow for Docker image build and publish"
```

---

### Task 12: Final verification and cleanup

**Step 1: Run the full test suite**

```bash
# Build fresh
docker build -t pied-piper:dev .

# Test all commands via wrapper
PIED_PIPER_IMAGE=pied-piper:dev bin/pied-piper version
PIED_PIPER_IMAGE=pied-piper:dev bin/pied-piper --help
PIED_PIPER_IMAGE=pied-piper:dev bin/pied-piper check-fast
PIED_PIPER_IMAGE=pied-piper:dev bin/pied-piper check-full
```

**Step 2: Verify target project impact**

Confirm that a user's project needs ONLY:
1. `pied-piper` wrapper on `$PATH` (from `bin/pied-piper` or `install.sh`)
2. Docker installed
3. `.claude/settings.local.json` with hooks pointing to `pied-piper`

No Justfile, no pyproject.toml tool sections, no biome.json, no lock files, no venvs.

**Step 3: Clean up test artifacts**

```bash
docker rmi pp-verify:latest pp-verify-node:latest 2>/dev/null || true
rm -rf /tmp/pp-verify
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: docker packaging implementation complete"
```

---

## File Summary

| File | Purpose |
|------|---------|
| `.dockerignore` | Exclude unnecessary files from build context |
| `docker/pyproject.toml` | Container-specific deps (pip-audit excluded) |
| `docker/entrypoint.sh` | Container CLI — env stripping, command routing |
| `docker/Justfile` | Container orchestration — category names, baked-in config paths, cache workarounds |
| `Dockerfile` | Multi-stage image build (Python + Node + Just) |
| `bin/pied-piper` | User-facing wrapper script with auto-mount of .venv/node_modules |
| `install.sh` | curl \| sh installer |
| `.github/workflows/docker-publish.yml` | CI build + publish to GHCR |

## Important: This Is Additive

The Docker image is a **parallel distribution channel**. It does NOT replace the existing Justfile, pyproject.toml, package.json, config files, or any part of the native development workflow. All existing files remain untouched and fully functional.

## Known Limitations (Container Only)

1. **pip-audit excluded from container** — requires network access to query vulnerability databases. Still works via the native Justfile (`just py-audit`).
2. **Test tools cannot run in container** — hypothesis, mutmut need the project's test suite and full dependency tree.
3. **ty degrades without .venv** — reports unresolved-import warnings for external packages. Still catches type errors. Wrapper auto-mounts .venv when available.
4. **tsc degrades without node_modules** — reports `Cannot find module` for external imports. Wrapper auto-mounts node_modules when available.
5. **macOS Docker I/O is 2-5x slower** than native for bind mounts.
6. **~1-3s startup overhead** per Docker invocation.
