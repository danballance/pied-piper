import subprocess
import sys
import tempfile
import textwrap
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


def test_complexity_check_passes_simple_function():
    with tempfile.TemporaryDirectory() as tmp:
        Path(tmp, "simple.py").write_text('def greet(name: str) -> str:\n    return f"hello {name}"\n')
        result = subprocess.run(
            [sys.executable, "-m", "piper_py.cli", "check-full"],
            capture_output=True, text=True, cwd=tmp,
        )
        assert "OK   py:complexity" in result.stdout


def test_complexity_check_fails_complex_function():
    """A deeply nested function should exceed cognitive complexity 15."""
    complex_code = textwrap.dedent("""\
        def process(data):
            for item in data:
                if item.get("type") == "a":
                    for sub in item.get("children", []):
                        if sub.get("active"):
                            if sub.get("value") > 0:
                                for x in sub.get("nested", []):
                                    if x != 0:
                                        if x > 10:
                                            return x
            return None
    """)
    with tempfile.TemporaryDirectory() as tmp:
        Path(tmp, "complex.py").write_text(complex_code)
        result = subprocess.run(
            [sys.executable, "-m", "piper_py.cli", "check-full"],
            capture_output=True, text=True, cwd=tmp,
        )
        assert result.returncode == 2
        assert "FAIL py:complexity" in result.stdout
