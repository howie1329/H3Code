import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const forbiddenImports = [
  ["@h3code", "pi-provider"].join("/"),
  ["@h3code", "agent-core"].join("/"),
  ["@h3code", "agent-server"].join("/"),
];

test("does not import old agent packages", async () => {
  const packageJson = await readFile(join(process.cwd(), "package.json"), "utf8");
  for (const forbidden of forbiddenImports) {
    assert.equal(packageJson.includes(forbidden), false, `package.json must not reference ${forbidden}`);
  }

  for (const file of await sourceFiles(join(process.cwd(), "src"))) {
    const source = await readFile(file, "utf8");
    for (const forbidden of forbiddenImports) {
      assert.equal(source.includes(forbidden), false, `${file} must not reference ${forbidden}`);
    }
  }
});

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    if (entry.isFile() && entry.name.endsWith(".ts")) files.push(path);
  }

  return files;
}
