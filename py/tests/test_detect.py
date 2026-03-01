import tempfile
from pathlib import Path

from piper_py.detect import has_files, has_config_section


def test_has_files_finds_py():
    with tempfile.TemporaryDirectory() as tmp:
        Path(tmp, "foo.py").touch()
        assert has_files({".py"}, root=tmp) is True


def test_has_files_empty_dir():
    with tempfile.TemporaryDirectory() as tmp:
        assert has_files({".py"}, root=tmp) is False


def test_has_files_excludes_venv():
    with tempfile.TemporaryDirectory() as tmp:
        venv = Path(tmp, ".venv")
        venv.mkdir()
        Path(venv, "lib.py").touch()
        assert has_files({".py"}, root=tmp) is False


def test_has_files_nested():
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp, "src", "pkg")
        src.mkdir(parents=True)
        Path(src, "main.py").touch()
        assert has_files({".py"}, root=tmp) is True


def test_has_config_section_found():
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp, "pyproject.toml")
        p.write_text("[tool.importlinter]\nroot = 'src'\n")
        assert (
            has_config_section("pyproject.toml", "[tool.importlinter]", root=tmp)
            is True
        )


def test_has_config_section_missing():
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp, "pyproject.toml")
        p.write_text("[project]\nname = 'foo'\n")
        assert (
            has_config_section("pyproject.toml", "[tool.importlinter]", root=tmp)
            is False
        )


def test_has_config_section_no_file():
    with tempfile.TemporaryDirectory() as tmp:
        assert (
            has_config_section("pyproject.toml", "[tool.importlinter]", root=tmp)
            is False
        )
