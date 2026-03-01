from __future__ import annotations

import sys
import subprocess

from piper_py import __version__
from piper_py.checks import ALL_CHECKS_BY_NAME, FAST_CHECKS, FULL_CHECKS
from piper_py.runner import run_check, run_checks


def _fix() -> None:
    subprocess.run(["ruff", "format", "."], check=False)
    subprocess.run(["ruff", "check", "--fix", "."], check=False)
    print("OK   fix")


def _check(name: str) -> None:
    if name == "fast":
        exit_code, outputs = run_checks(FAST_CHECKS)
        for output in outputs:
            print(output)
        sys.exit(exit_code)

    if name == "full":
        exit_code, outputs = run_checks(FULL_CHECKS)
        for output in outputs:
            print(output)
        sys.exit(exit_code)

    check = ALL_CHECKS_BY_NAME.get(name)
    if check is None:
        available = ", ".join(sorted(ALL_CHECKS_BY_NAME.keys()))
        print(f"error: unknown check '{name}'", file=sys.stderr)
        print(f"available checks: fast, full, {available}", file=sys.stderr)
        sys.exit(1)

    passed, output = run_check(check)
    print(output)
    sys.exit(0 if passed else 2)


def main(argv: list[str] | None = None) -> None:
    args = argv if argv is not None else sys.argv[1:]

    if not args:
        print("usage: pied-piper {check,fix,version} ...", file=sys.stderr)
        sys.exit(2)

    command = args[0]

    if command == "version":
        print(f"pied-piper {__version__}")
        return

    if command == "fix":
        _fix()
        return

    if command == "check":
        if len(args) < 2:
            available = ", ".join(sorted(ALL_CHECKS_BY_NAME.keys()))
            print("error: missing check name", file=sys.stderr)
            print(f"available checks: fast, full, {available}", file=sys.stderr)
            sys.exit(1)
        _check(args[1])
        return

    print(f"error: unknown command '{command}'", file=sys.stderr)
    print("usage: pied-piper {check,fix,version} ...", file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()
