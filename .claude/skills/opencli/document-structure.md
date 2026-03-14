# Document Structure

## Overview

An OpenCLI document is a single JSON or YAML file conforming to the OpenCLI 0.1 spec. The root object describes the CLI tool itself — its metadata, global options, top-level commands, and exit codes.

## Root Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `opencli` | string | **yes** | Spec version (currently `"0.1"`) |
| `info` | CliInfo | **yes** | Tool metadata |
| `conventions` | Conventions | no | Option grouping and separator rules |
| `arguments` | Argument[] | no | Root-level positional arguments |
| `options` | Option[] | no | Root-level options (global flags) |
| `commands` | Command[] | no | Top-level subcommands |
| `exitCodes` | ExitCode[] | no | Root-level exit codes |
| `examples` | string[] | no | Usage examples |
| `interactive` | boolean | no | Whether the tool requires interactive input (default `false`) |
| `metadata` | Metadata[] | no | Custom extension data |

## Info Object (CliInfo)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | **yes** | Application name |
| `version` | string | **yes** | Application version |
| `summary` | string | no | Short summary |
| `description` | string | no | Full description |
| `contact` | Contact | no | Maintainer info (`name`, `url`, `email`) |
| `license` | License | no | License info (`name`, `identifier`, `url`) |

```json
{
  "info": {
    "title": "piper-py",
    "version": "0.1.0",
    "description": "Code guardrails orchestrator for Python projects",
    "license": {
      "name": "MIT License",
      "identifier": "MIT"
    }
  }
}
```

## Conventions Object

Controls CLI parsing behavior:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `groupOptions` | boolean | `true` | Allow short-option grouping (e.g. `-abc` = `-a -b -c`) |
| `optionSeparator` | string | `" "` | Separator between option and its argument (`" "`, `"="`, etc.) |

## Docs

- Specification: <https://opencli.org>
