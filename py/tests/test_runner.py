from __future__ import annotations

from unittest.mock import MagicMock, patch

from piper_py.runner import run_command, run_commands


def test_run_command_success() -> None:
    with patch("piper_py.runner.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        passed, output = run_command("format", "ruff format --check .")
    assert passed is True
    assert output == "OK   format"


def test_run_command_failure() -> None:
    with patch("piper_py.runner.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(
            returncode=1,
            stdout="src/foo.py:1:1: F401 unused import\n",
            stderr="",
        )
        passed, output = run_command("lint", "ruff check .")
    assert passed is False
    assert "FAIL lint" in output
    assert "COMMAND ruff check ." in output
    assert "F401 unused import" in output


def test_run_commands_all_pass() -> None:
    commands = [("a", "echo ok"), ("b", "echo ok")]
    with patch("piper_py.runner.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        exit_code, outputs = run_commands(commands)
    assert exit_code == 0
    assert len(outputs) == 2


def test_run_commands_one_fails() -> None:
    commands = [("a", "true"), ("b", "false")]
    returns = [
        MagicMock(returncode=0, stdout="", stderr=""),
        MagicMock(returncode=1, stdout="error", stderr=""),
    ]
    with patch("piper_py.runner.subprocess.run", side_effect=returns):
        exit_code, outputs = run_commands(commands)
    assert exit_code == 2
    assert "OK   a" in outputs[0]
    assert "FAIL b" in outputs[1]


def test_run_commands_continues_after_failure() -> None:
    commands = [("a", "false"), ("b", "true")]
    returns = [
        MagicMock(returncode=1, stdout="err", stderr=""),
        MagicMock(returncode=0, stdout="", stderr=""),
    ]
    with patch("piper_py.runner.subprocess.run", side_effect=returns):
        exit_code, outputs = run_commands(commands)
    assert exit_code == 2
    assert len(outputs) == 2
    assert "FAIL a" in outputs[0]
    assert "OK   b" in outputs[1]
