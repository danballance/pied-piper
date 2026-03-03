from __future__ import annotations

import shutil
from types import MappingProxyType

from piper_py.detect import has_config_section, has_files
from piper_py.runner import Check

EXCLUDE_DIRS_CSV = ".venv,.devenv,.direnv,node_modules,dist,build,.next,__pycache__,.git,tests,test,__tests__,.worktrees,.claude"
EXCLUDE_DIRS_DOTSLASH = "./.venv,./.devenv,./.direnv,./node_modules,./dist,./build,./.next,./tests,./test,./.worktrees,./.claude"
EXCLUDE_DIRS = (
    ".venv",
    ".devenv",
    ".direnv",
    "node_modules",
    "dist",
    "build",
    ".next",
    "__pycache__",
    ".git",
    "tests",
    "test",
    "__tests__",
    ".worktrees",
    ".claude",
)

_EXCLUDE_FLAG = "--exclude"
_COMPLEXITY_EXCLUDE = tuple(
    element for dirname in EXCLUDE_DIRS for element in (_EXCLUDE_FLAG, dirname)
)


def _no_py() -> bool:
    return not has_files({".py"})


def _no_importlinter() -> bool:
    return not has_config_section("pyproject.toml", "[tool.importlinter]")


def _no_semgrep() -> bool:
    return shutil.which("semgrep") is None or not has_config_section(
        ".semgrep.yml", "rules:"
    )


FAST_CHECKS: tuple[Check, ...] = (
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
            "ty",
            "check",
            _EXCLUDE_FLAG,
            ".venv/",
            _EXCLUDE_FLAG,
            ".devenv/",
            _EXCLUDE_FLAG,
            "node_modules/",
            _EXCLUDE_FLAG,
            ".worktrees/",
            _EXCLUDE_FLAG,
            ".claude/",
            _EXCLUDE_FLAG,
            "**/tests/",
            _EXCLUDE_FLAG,
            "**/test/",
            _EXCLUDE_FLAG,
            "**/test_*.py",
            _EXCLUDE_FLAG,
            "**/*_test.py",
            _EXCLUDE_FLAG,
            "**/conftest.py",
            ".",
        ],
        skip_if=_no_py,
    ),
)

FULL_ONLY_CHECKS: tuple[Check, ...] = (
    Check(
        name="py:arch",
        command=["lint-imports", "--no-cache"],
        skip_if=_no_importlinter,
    ),
    Check(
        name="py:deadcode",
        command=[
            "vulture",
            ".",
            "--min-confidence",
            "80",
            _EXCLUDE_FLAG,
            EXCLUDE_DIRS_CSV,
        ],
        skip_if=_no_py,
    ),
    Check(
        name="py:security",
        command=[
            "bandit",
            "-r",
            ".",
            "-q",
            "-ll",
            _EXCLUDE_FLAG,
            EXCLUDE_DIRS_DOTSLASH,
        ],
        skip_if=_no_py,
    ),
    Check(
        name="py:complexity",
        command=[
            "complexipy",
            ".",
            "--max-complexity-allowed",
            "15",
            "--quiet",
            *_COMPLEXITY_EXCLUDE,
        ],
        skip_if=_no_py,
    ),
    Check(
        name="py:semgrep",
        command=[
            "semgrep",
            "scan",
            "--config",
            ".semgrep.yml",
            "--quiet",
            "--error",
            "--metrics=off",
            _EXCLUDE_FLAG,
            ".venv",
            _EXCLUDE_FLAG,
            ".devenv",
            _EXCLUDE_FLAG,
            "node_modules",
            _EXCLUDE_FLAG,
            ".worktrees",
            _EXCLUDE_FLAG,
            ".claude",
            _EXCLUDE_FLAG,
            "dist",
            _EXCLUDE_FLAG,
            "build",
            _EXCLUDE_FLAG,
            "tests",
            _EXCLUDE_FLAG,
            "test",
            _EXCLUDE_FLAG,
            "__tests__",
            _EXCLUDE_FLAG,
            "*_test.py",
            _EXCLUDE_FLAG,
            "test_*.py",
            _EXCLUDE_FLAG,
            "*.test.*",
            _EXCLUDE_FLAG,
            "*.spec.*",
            _EXCLUDE_FLAG,
            "conftest.py",
            ".",
        ],
        skip_if=_no_semgrep,
    ),
)

FULL_CHECKS = FAST_CHECKS + FULL_ONLY_CHECKS

STRICT_ONLY_CHECKS: tuple[Check, ...] = (
    Check(
        name="py:lint-strict",
        command=[
            "flake8",
            ".",
            "--select=WPS",
            "--extend-exclude",
            ",".join(EXCLUDE_DIRS),
        ],
        skip_if=_no_py,
    ),
)

STRICT_CHECKS = FULL_CHECKS + STRICT_ONLY_CHECKS

ALL_CHECKS_BY_NAME = MappingProxyType(
    {
        check.name.removeprefix("py:"): check
        for check in FULL_CHECKS + STRICT_ONLY_CHECKS
    }
)
