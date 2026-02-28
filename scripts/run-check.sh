#!/usr/bin/env bash
# Usage: ./scripts/run-check.sh <tool-name> <command...>
# Exits 0 on success, 2 on failure (Claude Code hook convention).

set -euo pipefail

TOOL_NAME="$1"
shift

OUTPUT=$("$@" 2>&1) && RC=0 || RC=$?

if [ "$RC" -eq 0 ]; then
    echo "OK $TOOL_NAME"
else
    echo "FAIL $TOOL_NAME"
    echo "COMMAND $*"
    echo "$OUTPUT"
    exit 2
fi
