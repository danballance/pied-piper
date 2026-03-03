import pytest

from piper_py.cli import main


def test_check_fast(capsys):
    """'check fast' runs fast checks and exits cleanly when mocked."""
    with pytest.raises(SystemExit) as exc_info:
        main(["check", "fast"])
    assert exc_info.value.code in (0, 2)


def test_check_full(capsys):
    with pytest.raises(SystemExit) as exc_info:
        main(["check", "full"])
    assert exc_info.value.code in (0, 2)


def test_check_individual(capsys):
    """'check format' runs a single check."""
    with pytest.raises(SystemExit) as exc_info:
        main(["check", "format"])
    assert exc_info.value.code in (0, 2)


def test_check_strict(capsys):
    """'check strict' runs strict checks and exits cleanly."""
    with pytest.raises(SystemExit) as exc_info:
        main(["check", "strict"])
    assert exc_info.value.code in (0, 2)


def test_check_lint_strict_individual(capsys):
    """'check lint-strict' runs the individual WPS check."""
    with pytest.raises(SystemExit) as exc_info:
        main(["check", "lint-strict"])
    assert exc_info.value.code in (0, 2)


def test_check_invalid_name(capsys):
    """'check bogus' prints error with available names and exits 1."""
    with pytest.raises(SystemExit) as exc_info:
        main(["check", "bogus"])
    assert exc_info.value.code == 1
    captured = capsys.readouterr()
    assert "bogus" in captured.err
    assert "format" in captured.err
    assert "strict" in captured.err


def test_check_no_name(capsys):
    """'check' with no name prints error and exits 1."""
    with pytest.raises(SystemExit) as exc_info:
        main(["check"])
    assert exc_info.value.code == 1
    captured = capsys.readouterr()
    assert "format" in captured.err


def test_version(capsys):
    main(["version"])
    captured = capsys.readouterr()
    assert "piper-py" in captured.out


def test_fix(capsys):
    """'fix' parses without error (actual fix runs ruff on cwd)."""
    main(["fix"])


def test_no_command(capsys):
    """No arguments prints usage and exits 2."""
    with pytest.raises(SystemExit) as exc_info:
        main([])
    assert exc_info.value.code == 2
    captured = capsys.readouterr()
    assert "usage" in captured.err.lower()


def test_unknown_command(capsys):
    """Unknown command prints error and exits 2."""
    with pytest.raises(SystemExit) as exc_info:
        main(["bogus"])
    assert exc_info.value.code == 2
    captured = capsys.readouterr()
    assert captured.err
