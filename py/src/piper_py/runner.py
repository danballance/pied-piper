from __future__ import annotations

import subprocess
from dataclasses import dataclass
from typing import Callable


@dataclass
class Check:
    name: str
    command: list[str]
    skip_if: Callable[[], bool]


def run_check(check: Check) -> tuple[bool, str]:
    if check.skip_if():
        return True, f"SKIP {check.name} (not applicable)"

    result = subprocess.run(check.command, capture_output=True, text=True)

    if result.returncode == 0:
        return True, f"OK   {check.name}"

    output = (result.stdout + result.stderr).rstrip()
    cmd_str = " ".join(check.command)
    return False, f"FAIL {check.name}\nCOMMAND {cmd_str}\n{output}"


def run_checks(checks: list[Check]) -> tuple[int, list[str]]:
    any_failed = False
    outputs: list[str] = []

    for check in checks:
        passed, output = run_check(check)
        outputs.append(output)
        if not passed:
            any_failed = True

    return 2 if any_failed else 0, outputs
