from __future__ import annotations

import os
import subprocess
from collections.abc import Callable, Sequence
from dataclasses import dataclass


@dataclass
class Check:
    name: str
    command: list[str]
    skip_if: Callable[[], bool]


def _clean_env() -> dict[str, str]:
    env = os.environ.copy()
    env.pop("VIRTUAL_ENV", None)
    return env


def run_check(check: Check) -> tuple[bool, str]:
    if check.skip_if():
        return True, f"SKIP {check.name} (not applicable)"

    completed = subprocess.run(
        check.command, capture_output=True, text=True, env=_clean_env()
    )

    if completed.returncode == 0:
        return True, f"OK   {check.name}"

    output = (completed.stdout + completed.stderr).rstrip()
    cmd_str = " ".join(check.command)
    return False, f"FAIL {check.name}\nCOMMAND {cmd_str}\n{output}"


def run_checks(checks: Sequence[Check]) -> tuple[int, list[str]]:
    any_failed = False
    outputs: list[str] = []

    for check in checks:
        passed, output = run_check(check)
        outputs.append(output)
        if not passed:
            any_failed = True

    return 2 if any_failed else 0, outputs
