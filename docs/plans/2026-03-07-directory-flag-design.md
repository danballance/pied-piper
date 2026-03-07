# Design: --directory / -d flag for both CLIs

## Problem

In monorepo layouts, Python code may live in `./api/` and TypeScript in `./ui/`, each with their own config files (pyproject.toml, biome.json, tsconfig.json, etc.). Currently both tools always run from cwd, so there's no way to target a subdirectory.

## Solution

Add a global `--directory <path>` / `-d <path>` flag to both `piper-py` and `piper-ts`. The flag is parsed before command dispatch and calls `chdir(path)` so all existing relative path logic (`.` references, config lookup, file detection) works unchanged.

## CLI Interface

```
piper-py --directory ./api check fast
piper-py -d ./api check fast
piper-ts --directory ./ui check fast
piper-ts -d ./ui check fast
```

## Implementation

Changes are limited to `cli.py` (Python) and `cli.ts` (TypeScript):

1. Scan argv for `--directory <path>` or `-d <path>`
2. Remove those two tokens from the args list
3. `os.chdir(path)` / `process.chdir(path)`
4. Continue with existing dispatch

No changes to `runner`, `checks`, or `detect` modules.

## Error Handling

- Directory doesn't exist → error message, exit 1
- `--directory` / `-d` without a value → usage error, exit 1

## Scope

Targets monorepos with per-package configs (each subdirectory has its own pyproject.toml / biome.json / tsconfig.json). Root-level-config-only layouts are out of scope.
