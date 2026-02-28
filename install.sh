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
