from __future__ import annotations

import os
import sys
from importlib.metadata import version
from pathlib import Path

from piper_py.config import load_config, resolve_commands
from piper_py.init import init
from piper_py.runner import run_commands


USAGE = "usage: piper-py [--directory <path>] {init,check,test,format,fix,version} ..."


def _run_section(section: str, name: str | None = None) -> None:
    try:
        config = load_config()
    except FileNotFoundError as e:
        sys.stderr.write(f"error: {e}\n")
        sys.exit(1)

    try:
        commands = resolve_commands(config, section, name)
    except (KeyError, ValueError) as e:
        sys.stderr.write(f"error: {e}\n")
        sys.exit(1)

    if not commands:
        sys.stderr.write(f"error: no commands configured for '{section}'\n")
        sys.exit(1)

    exit_code, outputs = run_commands(commands)
    stream = sys.stderr if exit_code else sys.stdout
    for line in outputs:
        stream.write(f"{line}\n")
    sys.exit(exit_code)


def _dispatch(args: list[str]) -> None:
    command = args[0]

    if command == "version":
        sys.stdout.write(f"piper-py {version('piper-py')}\n")
        return

    if command == "init":
        try:
            init()
            sys.stdout.write("Created .piper/piper.toml\n")
        except FileExistsError as e:
            sys.stderr.write(f"error: {e}\n")
            sys.exit(1)
        return

    if command in ("check", "test"):
        if len(args) < 2:
            sys.stderr.write(f"error: missing {command} name\n")
            sys.exit(1)
        _run_section(command, args[1])
        return

    if command in ("format", "fix"):
        _run_section(command)
        return

    sys.stderr.write(f"error: unknown command '{command}'\n")
    sys.stderr.write(f"{USAGE}\n")
    sys.exit(2)


def _extract_directory_flag(args: list[str]) -> list[str]:
    i = 0
    while i < len(args):
        if args[i] in ("--directory", "-d"):
            if i + 1 >= len(args):
                sys.stderr.write("error: --directory requires a path argument\n")
                sys.exit(1)
            target = Path(args[i + 1])
            if not target.is_dir():
                sys.stderr.write(f"error: directory does not exist: {target}\n")
                sys.exit(1)
            os.chdir(target)
            return args[:i] + args[i + 2 :]
        i += 1
    return args


def main(argv: list[str] | None = None) -> None:
    args = sys.argv[1:] if argv is None else argv
    args = _extract_directory_flag(args)
    if not args:
        sys.stderr.write(f"{USAGE}\n")
        sys.exit(2)
    _dispatch(args)


if __name__ == "__main__":
    main()
