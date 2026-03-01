from __future__ import annotations

import shutil

from piper_py.detect import has_config_section, has_files
from piper_py.runner import Check

EXCLUDE_DIRS_CSV = ".venv,.devenv,.direnv,node_modules,dist,build,.next,__pycache__,.git,tests,test,__tests__"
EXCLUDE_DIRS_DOTSLASH = "./.venv,./.devenv,./.direnv,./node_modules,./dist,./build,./.next,./tests,./test"
EXCLUDE_DIRS = [".venv", ".devenv", ".direnv", "node_modules", "dist", "build", ".next", "__pycache__", ".git", "tests", "test", "__tests__"]
_COMPLEXITY_EXCLUDE: list[str] = []
for _d in EXCLUDE_DIRS:
    _COMPLEXITY_EXCLUDE.extend(["--exclude", _d])


def _no_py() -> bool:
    return not has_files({".py"})


def _no_importlinter() -> bool:
    return not has_config_section("pyproject.toml", "[tool.importlinter]")


def _no_semgrep() -> bool:
    return shutil.which("semgrep") is None or not has_config_section(".semgrep.yml", "rules:")


FAST_CHECKS: list[Check] = [
    Check(
        name="py:format",
        command=["ruff", "format", "--check", "."],
        skip_if=_no_py,
    ),
    Check(
        name="py:lint",
        command=["ruff", "check", "."],
        skip_if=_no_py,
    ),
    Check(
        name="py:type",
        command=[
            "ty", "check",
            "--exclude", ".venv/",
            "--exclude", ".devenv/",
            "--exclude", "node_modules/",
            "--exclude", "tests/",
            "--exclude", "test/",
            "--exclude", "test_*.py",
            "--exclude", "*_test.py",
            "--exclude", "conftest.py",
            ".",
        ],
        skip_if=_no_py,
    ),
]

FULL_ONLY_CHECKS: list[Check] = [
    Check(
        name="py:arch",
        command=["lint-imports", "--no-cache"],
        skip_if=_no_importlinter,
    ),
    Check(
        name="py:deadcode",
        command=["vulture", ".", "--min-confidence", "80", "--exclude", EXCLUDE_DIRS_CSV],
        skip_if=_no_py,
    ),
    Check(
        name="py:security",
        command=["bandit", "-r", ".", "-q", "-ll", "--exclude", EXCLUDE_DIRS_DOTSLASH],
        skip_if=_no_py,
    ),
    Check(
        name="py:complexity",
        command=["complexipy", ".", "--max-complexity-allowed", "15", "--quiet", *_COMPLEXITY_EXCLUDE],
        skip_if=_no_py,
    ),
    Check(
        name="py:semgrep",
        command=[
            "semgrep", "scan",
            "--config", ".semgrep.yml",
            "--quiet", "--error", "--metrics=off",
            "--exclude", ".venv", "--exclude", ".devenv",
            "--exclude", "node_modules", "--exclude", "dist",
            "--exclude", "build", "--exclude", "tests",
            "--exclude", "test", "--exclude", "__tests__",
            "--exclude", "*_test.py", "--exclude", "test_*.py",
            "--exclude", "*.test.*", "--exclude", "*.spec.*",
            "--exclude", "conftest.py",
            ".",
        ],
        skip_if=_no_semgrep,
    ),
]

FULL_CHECKS = FAST_CHECKS + FULL_ONLY_CHECKS

ALL_CHECKS_BY_NAME: dict[str, Check] = {
    c.name.removeprefix("py:"): c for c in FULL_CHECKS
}
