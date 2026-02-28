from __future__ import annotations

import os
from pathlib import Path

EXCLUDE_DIRS = {
    ".venv", ".devenv", ".direnv", "node_modules", "dist", "build",
    ".next", "__pycache__", ".git", "tests", "test", "__tests__",
}


def has_files(extensions: set[str], root: str = ".") -> bool:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for f in filenames:
            if any(f.endswith(ext) for ext in extensions):
                return True
    return False


def has_config_section(filename: str, section: str, root: str = ".") -> bool:
    filepath = Path(root) / filename
    if not filepath.exists():
        return False
    return section in filepath.read_text()
