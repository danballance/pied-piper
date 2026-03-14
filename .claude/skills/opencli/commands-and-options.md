# Commands & Options

## Overview

Commands, options, and arguments are the building blocks of a CLI interface. Commands can nest recursively for multi-level subcommands. Options are named flags; arguments are positional parameters.

## Command Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **yes** | Command name |
| `aliases` | string[] | no | Alternative names (unique) |
| `description` | string | no | What the command does |
| `arguments` | Argument[] | no | Positional parameters |
| `options` | Option[] | no | Command-specific flags |
| `commands` | Command[] | no | Nested subcommands |
| `exitCodes` | ExitCode[] | no | Command-specific exit codes |
| `examples` | string[] | no | Usage examples |
| `interactive` | boolean | no | Requires interactive input (default `false`) |
| `hidden` | boolean | no | Hidden from help output (default `false`) |
| `metadata` | Metadata[] | no | Custom extension data |

```json
{
  "name": "check",
  "description": "Run code quality checks",
  "arguments": [
    {
      "name": "SUITE",
      "required": true,
      "description": "Check suite or individual check name",
      "acceptedValues": ["fast", "full", "format", "lint", "type"]
    }
  ],
  "exitCodes": [
    { "code": 0, "description": "All checks passed" },
    { "code": 2, "description": "One or more checks failed" }
  ]
}
```

## Option Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **yes** | Option name (e.g. `--directory`) |
| `aliases` | string[] | no | Short forms (e.g. `["-d"]`) |
| `description` | string | no | What the option does |
| `required` | boolean | no | Whether the option is required (default `false`) |
| `arguments` | Argument[] | no | Values the option accepts |
| `recursive` | boolean | no | Available to subcommands too (default `false`) |
| `group` | string | no | Logical grouping for help display |
| `hidden` | boolean | no | Hidden from help output (default `false`) |
| `metadata` | Metadata[] | no | Custom extension data |

```json
{
  "name": "--directory",
  "aliases": ["-d"],
  "description": "Change to directory before running",
  "arguments": [
    {
      "name": "PATH",
      "required": true,
      "arity": { "minimum": 1, "maximum": 1 }
    }
  ]
}
```

## Argument Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **yes** | Argument name (used in help text) |
| `required` | boolean | no | Whether the argument is required (default `false`) |
| `description` | string | no | What the argument represents |
| `arity` | Arity | no | Min/max value count (defaults: `min=1`, `max=1`) |
| `acceptedValues` | string[] | no | Enumerated valid values |
| `group` | string | no | Logical grouping |
| `hidden` | boolean | no | Hidden from help output (default `false`) |
| `metadata` | Metadata[] | no | Custom extension data |

## Arity Object

Controls how many values an argument accepts:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `minimum` | integer | `1` | Minimum number of values (≥ 0) |
| `maximum` | integer | `1` | Maximum number of values (≥ 0) |

Use `maximum: 0` for unlimited values. Use `minimum: 0` for optional values.

## Recursive Options

When `recursive: true`, an option defined on a parent command is also available to all its subcommands. Useful for global flags like `--verbose` or `--directory`:

```json
{
  "options": [
    {
      "name": "--directory",
      "aliases": ["-d"],
      "recursive": true,
      "arguments": [{ "name": "PATH", "required": true }]
    }
  ],
  "commands": [
    {
      "name": "check",
      "description": "Inherits --directory from parent"
    }
  ]
}
```

## Docs

- Specification: <https://opencli.org>
