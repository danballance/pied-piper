from __future__ import annotations

import os
from pathlib import Path

import pytest

from piper_py.config import load_config, resolve_commands


@pytest.fixture()
def config_dir(tmp_path: Path) -> Path:
    """Create a .piper dir with a sample piper.toml and chdir to its parent."""
    piper_dir = tmp_path / ".piper"
    piper_dir.mkdir()
    toml = piper_dir / "piper.toml"
    toml.write_text(
        """\
[check]
tiers = { fast = ["fast"], full = ["fast", "full"] }

[check.fast]
format = "ruff format --check ."
lint = "ruff check ."

[check.full]
arch = "import-linter"

[test]
tiers = { unit = ["unit"], full = ["unit", "full"], e2e = ["e2e"] }

[test.unit]
unit = "pytest -x"

[test.full]
contract = "pytest -m schemathesis"

[test.e2e]
e2e = "playwright test"

[format]
py = "ruff format ."

[fix]
lint = "ruff check --fix ."
"""
    )
    original = os.getcwd()
    os.chdir(tmp_path)
    yield tmp_path
    os.chdir(original)


def test_load_config_reads_toml(config_dir: Path) -> None:
    config = load_config()
    assert "check" in config
    assert "test" in config
    assert "format" in config
    assert "fix" in config


def test_load_config_missing_file_raises() -> None:
    with pytest.raises(FileNotFoundError, match="piper.toml"):
        load_config(Path("/nonexistent/.piper/piper.toml"))


def test_resolve_tier_fast(config_dir: Path) -> None:
    config = load_config()
    commands = resolve_commands(config, "check", "fast")
    names = [name for name, _ in commands]
    assert names == ["format", "lint"]


def test_resolve_tier_full_is_additive(config_dir: Path) -> None:
    config = load_config()
    commands = resolve_commands(config, "check", "full")
    names = [name for name, _ in commands]
    assert names == ["format", "lint", "arch"]


def test_resolve_individual_command(config_dir: Path) -> None:
    config = load_config()
    commands = resolve_commands(config, "check", "format")
    assert commands == [("format", "ruff format --check .")]


def test_resolve_unknown_name_raises(config_dir: Path) -> None:
    config = load_config()
    with pytest.raises(ValueError, match="bogus"):
        resolve_commands(config, "check", "bogus")


def test_resolve_format_section(config_dir: Path) -> None:
    config = load_config()
    commands = resolve_commands(config, "format")
    assert commands == [("py", "ruff format .")]


def test_resolve_fix_section(config_dir: Path) -> None:
    config = load_config()
    commands = resolve_commands(config, "fix")
    assert commands == [("lint", "ruff check --fix .")]


def test_resolve_test_tier_unit(config_dir: Path) -> None:
    config = load_config()
    commands = resolve_commands(config, "test", "unit")
    assert commands == [("unit", "pytest -x")]


def test_resolve_test_tier_full(config_dir: Path) -> None:
    config = load_config()
    commands = resolve_commands(config, "test", "full")
    names = [name for name, _ in commands]
    assert names == ["unit", "contract"]


def test_resolve_test_tier_e2e_standalone(config_dir: Path) -> None:
    config = load_config()
    commands = resolve_commands(config, "test", "e2e")
    assert commands == [("e2e", "playwright test")]


def test_resolve_test_individual(config_dir: Path) -> None:
    config = load_config()
    commands = resolve_commands(config, "test", "contract")
    assert commands == [("contract", "pytest -m schemathesis")]
