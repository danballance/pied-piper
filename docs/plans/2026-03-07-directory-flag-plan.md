# --directory / -d Flag Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `--directory <path>` / `-d <path>` global flag to both `piper-py` and `piper-ts` CLIs, allowing users to target a subdirectory in a monorepo.

**Architecture:** Parse the flag from argv before command dispatch, `chdir` into the target directory, then proceed as normal. All existing relative-path logic works unchanged.

**Tech Stack:** Python (piper-py), TypeScript (piper-ts), pytest, vitest

---

### Task 1: Add --directory flag to piper-py

**Files:**
- Modify: `py/src/piper_py/cli.py`
- Test: `py/tests/test_cli.py`

**Step 1: Write failing tests**

Add to `py/tests/test_cli.py`:

```python
import os
import tempfile
from pathlib import Path


def test_directory_flag_changes_cwd(capsys, tmp_path):
    """--directory changes working directory before running command."""
    original = os.getcwd()
    try:
        main(["--directory", str(tmp_path), "version"])
        assert os.getcwd() == str(tmp_path)
    finally:
        os.chdir(original)
    captured = capsys.readouterr()
    assert "piper-py" in captured.out


def test_directory_short_flag(capsys, tmp_path):
    """-d is an alias for --directory."""
    original = os.getcwd()
    try:
        main(["-d", str(tmp_path), "version"])
        assert os.getcwd() == str(tmp_path)
    finally:
        os.chdir(original)
    captured = capsys.readouterr()
    assert "piper-py" in captured.out


def test_directory_nonexistent(capsys):
    """--directory with nonexistent path exits 1."""
    with pytest.raises(SystemExit) as exc_info:
        main(["--directory", "/nonexistent/path/xyz", "version"])
    assert exc_info.value.code == 1
    captured = capsys.readouterr()
    assert "does not exist" in captured.err.lower() or "not" in captured.err.lower()


def test_directory_no_value(capsys):
    """--directory with no value exits 1."""
    with pytest.raises(SystemExit) as exc_info:
        main(["--directory"])
    assert exc_info.value.code == 1


def test_command_still_works_without_directory(capsys):
    """Existing commands work when --directory is not provided."""
    main(["version"])
    captured = capsys.readouterr()
    assert "piper-py" in captured.out
```

**Step 2: Run tests to verify they fail**

Run: `cd py && uv run pytest tests/test_cli.py -v -k "directory"`
Expected: FAIL — tests reference behavior that doesn't exist yet

**Step 3: Implement the flag parsing in cli.py**

Add a `_extract_directory_flag` function and call it at the start of `main()`:

```python
import os
from pathlib import Path


def _extract_directory_flag(args: list[str]) -> list[str]:
    """Extract --directory/-d flag, chdir if present, return remaining args."""
    i = 0
    while i < len(args):
        if args[i] in ("--directory", "-d"):
            if i + 1 >= len(args):
                sys.stderr.write("error: --directory requires a path argument\n")
                sys.exit(1)
            target = Path(args[i + 1])
            if not target.is_dir():
                sys.stderr.write(f"error: directory does not exist: {target}\n")
                sys.exit(1)
            os.chdir(target)
            return args[:i] + args[i + 2:]
        i += 1
    return args


def main(argv: list[str] | None = None) -> None:
    args = sys.argv[1:] if argv is None else argv
    args = _extract_directory_flag(args)
    if not args:
        _print_usage_error()
        sys.exit(2)
    _dispatch(args)
```

**Step 4: Run tests to verify they pass**

Run: `cd py && uv run pytest tests/test_cli.py -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add py/src/piper_py/cli.py py/tests/test_cli.py
git commit -m "feat: add --directory / -d flag to piper-py"
```

---

### Task 2: Add --directory flag to piper-ts

**Files:**
- Modify: `ts/src/cli.ts`
- Test: `ts/tests/cli.test.ts`

**Step 1: Write failing tests**

Add to `ts/tests/cli.test.ts`:

```typescript
import * as fs from "node:fs";
import * as os from "node:os";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "piper-test-"));
}

// Add these inside the existing describe("CLI", ...) block:

it("--directory flag runs in target directory", () => {
  const tmp = makeTmpDir();
  try {
    const { stdout, exitCode } = run(`--directory ${tmp} version`);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("piper-ts");
  } finally {
    fs.rmSync(tmp, { recursive: true });
  }
});

it("-d flag is alias for --directory", () => {
  const tmp = makeTmpDir();
  try {
    const { stdout, exitCode } = run(`-d ${tmp} version`);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("piper-ts");
  } finally {
    fs.rmSync(tmp, { recursive: true });
  }
});

it("--directory with nonexistent path exits 1", () => {
  const { exitCode, stderr } = run("--directory /nonexistent/xyz version");
  expect(exitCode).toBe(1);
  expect(stderr).toContain("does not exist");
});

it("--directory without value exits 1", () => {
  const { exitCode } = run("--directory");
  expect(exitCode).toBe(1);
});
```

**Step 2: Run tests to verify they fail**

Run: `cd ts && npx vitest run tests/cli.test.ts`
Expected: FAIL — new tests fail

**Step 3: Implement the flag parsing in cli.ts**

Add a `extractDirectoryFlag` function and call it at the start of `main()`:

```typescript
import * as fs from "node:fs";

function extractDirectoryFlag(args: string[]): string[] {
  const idx = args.findIndex((a) => a === "--directory" || a === "-d");
  if (idx === -1) return args;

  if (idx + 1 >= args.length) {
    console.error("error: --directory requires a path argument");
    process.exit(1);
  }

  const target = args[idx + 1];
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    console.error(`error: directory does not exist: ${target}`);
    process.exit(1);
  }

  process.chdir(target);
  return [...args.slice(0, idx), ...args.slice(idx + 2)];
}

function main(): void {
  let args = process.argv.slice(2);
  args = extractDirectoryFlag(args);

  // ... rest of existing main() unchanged
}
```

**Step 4: Run tests to verify they pass**

Run: `cd ts && npx vitest run tests/cli.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add ts/src/cli.ts ts/tests/cli.test.ts
git commit -m "feat: add --directory / -d flag to piper-ts"
```

---

### Task 3: Update docs and usage strings

**Files:**
- Modify: `docs/README.md`
- Modify: `py/src/piper_py/cli.py` (usage string)
- Modify: `ts/src/cli.ts` (usage string)

**Step 1: Update usage strings**

In `py/src/piper_py/cli.py`, update `_print_usage_error`:
```python
def _print_usage_error(command: str | None = None) -> None:
    if command is not None:
        sys.stderr.write(f"error: unknown command '{command}'\n")
    sys.stderr.write("usage: piper-py [--directory <path>] {check,fix,format,version} ...\n")
```

In `ts/src/cli.ts`, update both usage error messages:
```typescript
console.error("usage: piper-ts [--directory <path>] {check,fix,format,version} ...");
```

**Step 2: Update docs/README.md**

Add a "Monorepo Usage" section after "Hook Configuration":

```markdown
## Monorepo Usage

Use `--directory` / `-d` to target a subdirectory. Each subdirectory should have its own config files (pyproject.toml, biome.json, tsconfig.json, etc.):

\`\`\`bash
# Check Python code in api/
uvx piper-py --directory ./api check fast

# Check TypeScript code in ui/
npx piper-ts -d ./ui check fast
\`\`\`

Hook configuration for monorepos:

\`\`\`json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "uvx piper-py -d ./api check fast" },
          { "type": "command", "command": "npx piper-ts -d ./ui check fast" }
        ]
      }
    ]
  }
}
\`\`\`
```

**Step 3: Run all tests**

Run: `cd py && uv run pytest -v && cd ../ts && npx vitest run`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add docs/README.md py/src/piper_py/cli.py ts/src/cli.ts
git commit -m "docs: update usage strings and README for --directory flag"
```
