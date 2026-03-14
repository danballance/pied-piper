from __future__ import annotations

import os
import tomllib
from pathlib import Path

import pytest

from piper_py.init import init, TEMPLATE


@pytest.fixture()
def work_dir(tmp_path: Path) -> Path:
    original = os.getcwd()
    os.chdir(tmp_path)
    yield tmp_path
    os.chdir(original)


def test_init_creates_piper_dir(work_dir: Path) -> None:
    init()
    assert (work_dir / ".piper").is_dir()


def test_init_creates_piper_toml(work_dir: Path) -> None:
    init()
    assert (work_dir / ".piper" / "piper.toml").is_file()


def test_init_toml_is_valid(work_dir: Path) -> None:
    init()
    content = (work_dir / ".piper" / "piper.toml").read_bytes()
    config = tomllib.loads(content.decode())
    assert "check" in config
    assert "test" in config
    assert "format" in config
    assert "fix" in config
    assert "tiers" in config["check"]
    assert "tiers" in config["test"]


def test_init_errors_if_exists(work_dir: Path) -> None:
    init()
    with pytest.raises(FileExistsError, match="already exists"):
        init()


def test_template_is_valid_toml() -> None:
    config = tomllib.loads(TEMPLATE)
    assert "check" in config
