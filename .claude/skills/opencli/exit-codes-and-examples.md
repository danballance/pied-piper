# Exit Codes & Examples

## Overview

Exit codes document the return values a CLI can produce. Examples show invocation patterns. Metadata provides extensibility for custom tooling.

## ExitCode Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | integer | **yes** | The numeric exit code |
| `description` | string | no | What this code means |

Exit codes can be defined at root level (apply to all commands) or per-command:

```json
{
  "exitCodes": [
    { "code": 0, "description": "Success — all checks passed" },
    { "code": 1, "description": "Usage error or unknown check" },
    { "code": 2, "description": "One or more checks failed" }
  ]
}
```

## Examples

Examples are plain strings showing CLI invocations. Define at root or per-command:

```json
{
  "examples": [
    "piper-py check fast",
    "piper-py --directory ./my-project check full",
    "piper-py format",
    "piper-py version"
  ]
}
```

## Metadata Object

Extensibility mechanism for custom data. Each entry is a name/value pair:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **yes** | Metadata key |
| `value` | any | no | Metadata value (any JSON type) |

```json
{
  "metadata": [
    { "name": "category", "value": "development-tools" },
    { "name": "min-node-version", "value": "18.0.0" }
  ]
}
```

## Docs

- Specification: <https://opencli.org>
