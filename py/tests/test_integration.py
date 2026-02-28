import subprocess
import sys
import tempfile
from pathlib import Path


def test_check_fast_on_clean_python_file():
    with tempfile.TemporaryDirectory() as tmp:
        Path(tmp, "hello.py").write_text('def greet() -> str:\n    return "hello"\n')
        result = subprocess.run(
            [sys.executable, "-m", "piper_py.cli", "check-fast"],
            capture_output=True, text=True, cwd=tmp,
        )
        assert "py:format" in result.stdout
        assert "py:lint" in result.stdout


def test_check_fast_skips_when_no_py_files():
    with tempfile.TemporaryDirectory() as tmp:
        result = subprocess.run(
            [sys.executable, "-m", "piper_py.cli", "check-fast"],
            capture_output=True, text=True, cwd=tmp,
        )
        assert result.returncode == 0
        assert "SKIP" in result.stdout


def test_check_fast_catches_lint_error():
    with tempfile.TemporaryDirectory() as tmp:
        Path(tmp, "bad.py").write_text("import os\n")  # unused import
        result = subprocess.run(
            [sys.executable, "-m", "piper_py.cli", "check-fast"],
            capture_output=True, text=True, cwd=tmp,
        )
        assert result.returncode == 2
        assert "FAIL" in result.stdout
