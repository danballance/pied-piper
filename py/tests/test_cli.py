import subprocess
import sys


def test_cli_version():
    result = subprocess.run(
        [sys.executable, "-m", "piper_py.cli", "version"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0
    assert "pied-piper" in result.stdout


def test_cli_help():
    result = subprocess.run(
        [sys.executable, "-m", "piper_py.cli", "--help"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0
    assert "check-fast" in result.stdout


def test_cli_unknown_command():
    result = subprocess.run(
        [sys.executable, "-m", "piper_py.cli", "nonsense"],
        capture_output=True, text=True,
    )
    assert result.returncode != 0
