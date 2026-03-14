from __future__ import annotations

from importlib.resources import files
from pathlib import Path

TEMPLATE = files("piper_py.templates").joinpath("piper.toml").read_text()


def init() -> None:
    piper_dir = Path(".piper")
    config_path = piper_dir / "piper.toml"
    if config_path.exists():
        msg = f"{config_path} already exists\nDelete it first if you want to regenerate."
        raise FileExistsError(msg)
    piper_dir.mkdir(exist_ok=True)
    config_path.write_text(TEMPLATE)
