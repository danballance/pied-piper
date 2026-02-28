# Stage 1: Install Python tools
FROM python:3.12-slim AS python-builder
WORKDIR /build
RUN pip install --no-cache-dir uv
COPY docker/pyproject.toml pyproject.toml
COPY uv.lock ./
# Create venv and install dev dependencies (uses docker/pyproject.toml which excludes pip-audit)
# --active tells uv to sync into the active (VIRTUAL_ENV-pointed) environment
RUN uv venv /opt/venv && \
    VIRTUAL_ENV=/opt/venv uv sync --active --frozen --no-install-project

# Stage 2: Install Node tools
FROM node:20-slim AS node-builder
WORKDIR /build
COPY package.json package-lock.json ./
# --ignore-scripts prevents postinstall supply chain attacks broadly
# Then run only the ast-grep postinstall (which copies the platform binary into place)
# Biome uses a Node.js wrapper that resolves the binary at runtime — no postinstall needed
RUN npm ci --ignore-scripts && \
    node node_modules/@ast-grep/cli/postinstall.js && \
    npx @biomejs/biome --version && \
    node_modules/.bin/ast-grep --version

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
ENV SEMGREP_SETTINGS_FILE="/tmp/semgrep-settings.yaml"
ENV SEMGREP_LOG_FILE="/tmp/semgrep.log"
ENV PIED_PIPER_MODE=docker

# Copy baked-in configs
COPY biome.json .semgrep.yml sgconfig.yml pyproject.toml tsconfig.json /etc/pied-piper/
COPY rules/ /etc/pied-piper/rules/

# Copy orchestration
COPY Justfile /opt/pied-piper/Justfile
COPY scripts/run-check.sh /opt/pied-piper/scripts/run-check.sh
RUN chmod +x /opt/pied-piper/scripts/run-check.sh

# Copy entrypoint
COPY docker/entrypoint.sh /usr/local/bin/pied-piper
RUN chmod +x /usr/local/bin/pied-piper

# Create non-root user with home dir so semgrep/other tools can write caches
RUN groupadd --gid 1000 piper && \
    useradd --uid 1000 --gid piper --create-home piper && \
    mkdir -p /tmp/ruff-cache && chown piper:piper /tmp/ruff-cache
USER piper

WORKDIR /work
ENTRYPOINT ["pied-piper"]
CMD ["--help"]
