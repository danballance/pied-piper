from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def clean_env() -> dict[str, str]:
    env = os.environ.copy()
    env.pop("VIRTUAL_ENV", None)
    tool_bin = str(Path(sys.prefix) / "bin")
    env["PATH"] = tool_bin + os.pathsep + env.get("PATH", "")
    return env


def run_command(name: str, command: str) -> tuple[bool, str]:
    completed = subprocess.run(
        command, shell=True, capture_output=True, text=True, env=clean_env()
    )
    if completed.returncode == 0:
        return True, f"OK   {name}"
    output = (completed.stdout + completed.stderr).rstrip()
    return False, f"FAIL {name}\nCOMMAND {command}\n{output}"


def run_commands(commands: list[tuple[str, str]]) -> tuple[int, list[str]]:
    any_failed = False
    outputs: list[str] = []
    for name, command in commands:
        passed, output = run_command(name, command)
        outputs.append(output)
        if not passed:
            any_failed = True
    return 2 if any_failed else 0, outputs
