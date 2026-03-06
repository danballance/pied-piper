import * as fs from "node:fs";
import * as path from "node:path";

const EXCLUDE_DIRS = new Set([
  ".venv",
  ".devenv",
  ".direnv",
  "node_modules",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".git",
  "tests",
  "test",
  "__tests__",
]);

export function hasFiles(extensions: string[], root: string = "."): boolean {
  function walk(dir: string): boolean {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name)) {
          if (walk(path.join(dir, entry.name))) return true;
        }
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        return true;
      }
    }
    return false;
  }
  return walk(root);
}

export function hasConfigFile(filename: string, root: string = "."): boolean {
  return fs.existsSync(path.join(root, filename));
}
