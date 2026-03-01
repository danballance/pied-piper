from __future__ import annotations

import subprocess
import sys
from importlib.metadata import version

from piper_py.checks import ALL_CHECKS_BY_NAME, FAST_CHECKS, FULL_CHECKS, STRICT_CHECKS
from piper_py.runner import run_check, run_checks


def _fix() -> None:
    subprocess.run(["ruff", "format", "."], check=False)
    subprocess.run(["ruff", "check", "--fix", "."], check=False)
    sys.stdout.write("OK   fix\n")


def _run_suite(name: str) -> None:
    suites = {"fast": FAST_CHECKS, "full": FULL_CHECKS, "strict": STRICT_CHECKS}
    suite = suites.get(name)
    if suite is not None:
        exit_code, outputs = run_checks(suite)
        stream = sys.stderr if exit_code else sys.stdout
        for line in outputs:
            stream.write(f"{line}\n")
        sys.exit(exit_code)


def _run_single(name: str) -> None:
    check = ALL_CHECKS_BY_NAME.get(name)
    if check is None:
        available = ", ".join(sorted(ALL_CHECKS_BY_NAME.keys()))
        sys.stderr.write(f"error: unknown check '{name}'\n")
        sys.stderr.write(f"available checks: fast, full, strict, {available}\n")
        sys.exit(1)
    passed, message = run_check(check)
    stream = sys.stdout if passed else sys.stderr
    stream.write(f"{message}\n")
    sys.exit(0 if passed else 2)


def _handle_check_command(args: list[str]) -> None:
    if len(args) < 2:
        available = ", ".join(sorted(ALL_CHECKS_BY_NAME.keys()))
        sys.stderr.write("error: missing check name\n")
        sys.stderr.write(f"available checks: fast, full, strict, {available}\n")
        sys.exit(1)
    _run_suite(args[1])
    _run_single(args[1])


def _print_usage_error(command: str | None = None) -> None:
    if command is not None:
        sys.stderr.write(f"error: unknown command '{command}'\n")
    sys.stderr.write("usage: pied-piper {check,fix,version} ...\n")


def _dispatch(args: list[str]) -> None:
    command = args[0]
    actions = {
        "version": lambda: sys.stdout.write(f"pied-piper {version('pied-piper')}\n"),
        "fix": _fix,
        "check": lambda: _handle_check_command(args),
    }
    action = actions.get(command)
    if action is None:
        _print_usage_error(command)
        sys.exit(2)
    action()


def main(argv: list[str] | None = None) -> None:
    args = sys.argv[1:] if argv is None else argv
    if not args:
        _print_usage_error()
        sys.exit(2)
    _dispatch(args)


if __name__ == "__main__":
    main()
