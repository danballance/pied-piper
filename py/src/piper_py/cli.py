from __future__ import annotations

import argparse
import subprocess
import sys

from piper_py import __version__
from piper_py.checks import FAST_CHECKS, FULL_CHECKS
from piper_py.runner import run_checks


def _fix() -> None:
    subprocess.run(["ruff", "format", "."], check=False)
    subprocess.run(["ruff", "check", "--fix", "."], check=False)
    print("OK   fix")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="pied-piper",
        description="Python code guardrails for agentic coding workflows",
    )
    parser.add_argument(
        "command",
        choices=["check-fast", "check-full", "fix", "version"],
    )
    args = parser.parse_args(argv)

    if args.command == "version":
        print(f"pied-piper {__version__}")
        return

    if args.command == "fix":
        _fix()
        return

    checks = FAST_CHECKS if args.command == "check-fast" else FULL_CHECKS
    exit_code, outputs = run_checks(checks)
    for output in outputs:
        print(output)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
