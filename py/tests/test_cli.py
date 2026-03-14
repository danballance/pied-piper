from __future__ import annotations

import os
from pathlib import Path

import pytest

from piper_py.cli import main


@pytest.fixture()
def config_env(tmp_path: Path) -> Path:
    """Create a .piper/piper.toml with echo-based commands for testing."""
    piper_dir = tmp_path / ".piper"
    piper_dir.mkdir()
    (piper_dir / "piper.toml").write_text(
        """\
[check]
tiers = { fast = ["fast"], full = ["fast", "full"] }

[check.fast]
format = "echo check-format"
lint = "echo check-lint"

[check.full]
arch = "echo check-arch"

[test]
tiers = { unit = ["unit"], full = ["unit", "full"], e2e = ["e2e"] }

[test.unit]
unit = "echo test-unit"

[test.full]
contract = "echo test-contract"

[test.e2e]
e2e = "echo test-e2e"

[format]
py = "echo format-py"

[fix]
lint = "echo fix-lint"
"""
    )
    original = os.getcwd()
    os.chdir(tmp_path)
    yield tmp_path
    os.chdir(original)


def test_check_fast(config_env: Path, capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["check", "fast"])
    assert exc.value.code == 0
    captured = capsys.readouterr()
    assert "OK   format" in captured.out
    assert "OK   lint" in captured.out


def test_check_full(config_env: Path, capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["check", "full"])
    assert exc.value.code == 0
    captured = capsys.readouterr()
    assert "OK   format" in captured.out
    assert "OK   arch" in captured.out


def test_check_individual(config_env: Path, capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["check", "format"])
    assert exc.value.code == 0
    captured = capsys.readouterr()
    assert "OK   format" in captured.out


def test_check_invalid_name(config_env: Path, capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["check", "bogus"])
    assert exc.value.code == 1
    captured = capsys.readouterr()
    assert "bogus" in captured.err


def test_check_no_name(capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["check"])
    assert exc.value.code == 1
    captured = capsys.readouterr()
    assert "missing" in captured.err.lower()


def test_test_unit(config_env: Path, capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["test", "unit"])
    assert exc.value.code == 0
    captured = capsys.readouterr()
    assert "OK   unit" in captured.out


def test_test_full(config_env: Path, capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["test", "full"])
    assert exc.value.code == 0
    captured = capsys.readouterr()
    assert "OK   unit" in captured.out
    assert "OK   contract" in captured.out


def test_test_e2e_standalone(config_env: Path, capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["test", "e2e"])
    assert exc.value.code == 0
    captured = capsys.readouterr()
    assert "OK   e2e" in captured.out
    assert "unit" not in captured.out


def test_test_individual(config_env: Path, capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["test", "contract"])
    assert exc.value.code == 0
    captured = capsys.readouterr()
    assert "OK   contract" in captured.out


def test_test_no_name(capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["test"])
    assert exc.value.code == 1


def test_format_command(config_env: Path, capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["format"])
    assert exc.value.code == 0
    captured = capsys.readouterr()
    assert "OK   py" in captured.out


def test_fix_command(config_env: Path, capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["fix"])
    assert exc.value.code == 0
    captured = capsys.readouterr()
    assert "OK   lint" in captured.out


def test_init_command(tmp_path: Path) -> None:
    original = os.getcwd()
    os.chdir(tmp_path)
    try:
        main(["init"])
        assert (tmp_path / ".piper" / "piper.toml").exists()
    finally:
        os.chdir(original)


def test_version(capsys) -> None:
    main(["version"])
    captured = capsys.readouterr()
    assert "piper-py" in captured.out


def test_no_command(capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main([])
    assert exc.value.code == 2
    captured = capsys.readouterr()
    assert "usage" in captured.err.lower()


def test_unknown_command(capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["bogus"])
    assert exc.value.code == 2


def test_no_config_error(tmp_path: Path, capsys) -> None:
    original = os.getcwd()
    os.chdir(tmp_path)
    try:
        with pytest.raises(SystemExit) as exc:
            main(["check", "fast"])
        assert exc.value.code == 1
        captured = capsys.readouterr()
        assert "init" in captured.err
    finally:
        os.chdir(original)


def test_directory_flag(config_env: Path, capsys, tmp_path: Path) -> None:
    other = tmp_path / "other"
    other.mkdir()
    piper_dir = other / ".piper"
    piper_dir.mkdir()
    (piper_dir / "piper.toml").write_text(
        '[format]\npy = "echo from-other"\n'
    )
    original = os.getcwd()
    try:
        with pytest.raises(SystemExit) as exc:
            main(["--directory", str(other), "format"])
        assert exc.value.code == 0
    finally:
        os.chdir(original)


def test_directory_short_flag(capsys, tmp_path: Path) -> None:
    original = os.getcwd()
    try:
        main(["-d", str(tmp_path), "version"])
        assert os.getcwd() == str(tmp_path)
    finally:
        os.chdir(original)


def test_directory_nonexistent(capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["--directory", "/nonexistent/path/xyz", "version"])
    assert exc.value.code == 1


def test_directory_no_value(capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["--directory"])
    assert exc.value.code == 1


def test_check_failing_command(tmp_path: Path, capsys) -> None:
    piper_dir = tmp_path / ".piper"
    piper_dir.mkdir()
    (piper_dir / "piper.toml").write_text(
        '[check]\ntiers = { fast = ["fast"] }\n\n[check.fast]\nfail = "exit 1"\n'
    )
    original = os.getcwd()
    os.chdir(tmp_path)
    try:
        with pytest.raises(SystemExit) as exc:
            main(["check", "fast"])
        assert exc.value.code == 2
        captured = capsys.readouterr()
        assert "FAIL fail" in captured.err
    finally:
        os.chdir(original)
