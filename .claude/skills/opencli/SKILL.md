---
name: opencli
description: Use when defining, reading, or comparing CLI interface specifications using the OpenCLI standard
---

# OpenCLI

## Overview

OpenCLI is a language-agnostic specification for describing command-line interfaces, inspired by OpenAPI. Schemas are written in JSON or YAML and describe commands, options, arguments, and exit codes.

## Document Skeleton

Every OpenCLI document requires two fields: `opencli` (version) and `info` (title + version). Everything else is optional.

```json
{
  "$schema": "https://opencli.org/draft.json",
  "opencli": "0.1",
  "info": { "title": "my-tool", "version": "1.0.0" },
  "options": [],
  "commands": [],
  "exitCodes": [],
  "examples": []
}
```

## Key Concepts

| Concept | What it describes | Required fields |
|---------|-------------------|-----------------|
| `info` | CLI metadata (title, version, license, contact) | `title`, `version` |
| `commands` | Subcommands (can nest recursively) | `name` |
| `options` | Flags like `--verbose`, `-d` | `name` |
| `arguments` | Positional parameters | `name` |
| `exitCodes` | Return codes and their meaning | `code` |
| `conventions` | Option grouping, separator style | _(none)_ |
| `metadata` | Custom extension data | `name` |

## Sub-skills index

| Topic | File | When to use |
|-------|------|-------------|
| Document Structure | `document-structure.md` | Top-level schema, info object, conventions |
| Commands & Options | `commands-and-options.md` | Defining commands, subcommands, options, arguments, arity |
| Exit Codes & Examples | `exit-codes-and-examples.md` | Exit codes, usage examples, metadata |
| JSON Schema | `json-schema.md` | Full validation schema for tooling |

## Key docs links

- Specification: <https://opencli.org>
- JSON Schema: <https://opencli.org/draft.json>
- Examples: <https://opencli.org/examples>
