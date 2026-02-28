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
    rc=0
    just --justfile "$JUSTFILE" --working-directory /work "$1" 2>/tmp/just-stderr.log || rc=$?
    if [ "$rc" -ne 0 ] && [ -s /tmp/just-stderr.log ]; then
        cat /tmp/just-stderr.log
    fi
    exit "$rc"
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
