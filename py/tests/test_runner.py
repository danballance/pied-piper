from unittest.mock import patch, MagicMock
from piper_py.runner import Check, run_check, run_checks


def test_run_check_success():
    check = Check(
        name="test:pass",
        command=["echo", "hello"],
        skip_if=lambda: False,
    )
    with patch("piper_py.runner.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        passed, output = run_check(check)
    assert passed is True
    assert output == "OK   test:pass"


def test_run_check_failure():
    check = Check(
        name="test:fail",
        command=["ruff", "check", "."],
        skip_if=lambda: False,
    )
    with patch("piper_py.runner.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(
            returncode=1,
            stdout="src/foo.py:1:1: F401 unused import\n",
            stderr="",
        )
        passed, output = run_check(check)
    assert passed is False
    assert "FAIL test:fail" in output
    assert "COMMAND ruff check ." in output
    assert "F401 unused import" in output


def test_run_check_skip():
    check = Check(
        name="test:skip",
        command=["echo"],
        skip_if=lambda: True,
    )
    passed, output = run_check(check)
    assert passed is True
    assert "SKIP test:skip" in output


def test_run_checks_all_pass():
    checks = [
        Check(name="a", command=["true"], skip_if=lambda: False),
        Check(name="b", command=["true"], skip_if=lambda: False),
    ]
    with patch("piper_py.runner.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        exit_code, outputs = run_checks(checks)
    assert exit_code == 0
    assert len(outputs) == 2


def test_run_checks_one_fails():
    checks = [
        Check(name="a", command=["true"], skip_if=lambda: False),
        Check(name="b", command=["false"], skip_if=lambda: False),
    ]
    returns = [
        MagicMock(returncode=0, stdout="", stderr=""),
        MagicMock(returncode=1, stdout="error", stderr=""),
    ]
    with patch("piper_py.runner.subprocess.run", side_effect=returns):
        exit_code, outputs = run_checks(checks)
    assert exit_code == 2
    assert "OK   a" in outputs[0]
    assert "FAIL b" in outputs[1]


def test_run_checks_continues_after_failure():
    """All checks run even if an earlier one fails."""
    checks = [
        Check(name="a", command=["false"], skip_if=lambda: False),
        Check(name="b", command=["true"], skip_if=lambda: False),
    ]
    returns = [
        MagicMock(returncode=1, stdout="err", stderr=""),
        MagicMock(returncode=0, stdout="", stderr=""),
    ]
    with patch("piper_py.runner.subprocess.run", side_effect=returns):
        exit_code, outputs = run_checks(checks)
    assert exit_code == 2
    assert len(outputs) == 2
    assert "FAIL a" in outputs[0]
    assert "OK   b" in outputs[1]
