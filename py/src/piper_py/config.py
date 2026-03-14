from __future__ import annotations

import tomllib
from pathlib import Path

CONFIG_PATH = Path(".piper/piper.toml")


def load_config(config_path: Path = CONFIG_PATH) -> dict:
    if not config_path.exists():
        msg = f"{config_path} not found\nRun 'piper-py init' to generate the default configuration."
        raise FileNotFoundError(msg)
    with open(config_path, "rb") as f:
        return tomllib.load(f)


def resolve_commands(
    config: dict, section: str, name: str | None = None
) -> list[tuple[str, str]]:
    section_data = config.get(section)
    if section_data is None:
        msg = f"section '{section}' not found in config"
        raise KeyError(msg)

    if name is None:
        return [(k, v) for k, v in section_data.items() if isinstance(v, str)]

    tiers = section_data.get("tiers", {})
    if name in tiers:
        groups = tiers[name]
        commands: list[tuple[str, str]] = []
        for group_name in groups:
            group = section_data.get(group_name, {})
            commands.extend((k, v) for k, v in group.items() if isinstance(v, str))
        return commands

    for key, value in section_data.items():
        if key == "tiers":
            continue
        if isinstance(value, dict) and name in value:
            return [(name, value[name])]

    available = _available_names(section_data)
    msg = f"unknown name '{name}'\navailable: {', '.join(available)}"
    raise ValueError(msg)


def _available_names(section_data: dict) -> list[str]:
    tiers = list(section_data.get("tiers", {}).keys())
    individuals: list[str] = []
    for key, value in section_data.items():
        if key != "tiers" and isinstance(value, dict):
            individuals.extend(value.keys())
    return tiers + sorted(individuals)
