from __future__ import annotations

import os
from pathlib import Path

EXCLUDE_DIRS = frozenset(
    (
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
    )
)


def _prune_excluded(dirnames: list[str]) -> None:
    for dirname in list(dirnames):
        if dirname in EXCLUDE_DIRS:
            dirnames.remove(dirname)


def has_files(extensions: set[str], root: str = ".") -> bool:
    for dirpath, dirnames, filenames in os.walk(root):
        _prune_excluded(dirnames)
        for filename in filenames:
            if any(filename.endswith(ext) for ext in extensions):
                return True
    return False


def has_config_section(filename: str, section: str, root: str = ".") -> bool:
    filepath = Path(root) / filename
    if not filepath.exists():
        return False
    return section in filepath.read_text()
