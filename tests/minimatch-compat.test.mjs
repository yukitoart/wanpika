import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import minimatch from "minimatch";
import { Minimatch } from "minimatch";
import { ESLint } from "eslint";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);

test("supports legacy CommonJS calls and ESM default imports", () => {
  assert.equal(typeof require("minimatch"), "function");
  assert.equal(new Minimatch("*.ts").match("types.ts"), true);
  const cases = [
    ["src/app/page.tsx", "**/*.{ts,tsx}", {}, true],
    ["src/app/page.js", "**/*.tsx", {}, false],
    ["src/components/Header.tsx", "*.tsx", { matchBase: true }, true],
    [".next/server/app.js", "**/*.js", {}, false],
    [".next/server/app.js", "**/*.js", { dot: true }, true],
    ["src/app/page.tsx", "!**/*.js", {}, true],
    ["src/app/page.tsx", "src/**/+(page|layout).tsx", {}, true],
    ["src/lib/types.ts", "src/**/[a-z]*.ts", {}, true],
  ];
  for (const [path, pattern, options, expected] of cases) {
    assert.equal(minimatch(path, pattern, options), expected, `${path}: ${pattern}`);
    assert.equal(new minimatch.Minimatch(pattern, options).match(path), expected);
  }
});

test("retains helpers and defaults used by legacy consumers", () => {
  assert.deepEqual(minimatch.match(["a.ts", "b.js"], "*.ts"), ["a.ts"]);
  assert.equal(minimatch.filter("*.tsx")("Header.tsx"), true);
  assert.equal(minimatch.makeRe("*.ts").test("types.ts"), true);
  assert.deepEqual(minimatch.braceExpand("*.{ts,tsx}"), ["*.ts", "*.tsx"]);
  const defaults = minimatch.defaults({ dot: true });
  assert.equal(defaults(".hidden.ts", "*.ts"), true);
  assert.equal(new defaults.Minimatch("*.ts").match(".hidden.ts"), true);
});

test("ships only the fixed engine and handles adversarial patterns in bounded time", async () => {
  const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url)));
  const engines = Object.entries(lock.packages).filter(([path, pkg]) =>
    path.endsWith("/minimatch-modern") || pkg.resolved?.includes("/minimatch/-/"),
  );
  assert.ok(engines.length > 0);
  for (const [, pkg] of engines) assert.equal(pkg.version, "11.0.1");
  const result = spawnSync(process.execPath, ["-e", `
    const mm = require('minimatch');
    const path = 'a'.repeat(500);
    const pattern = '*a'.repeat(200) + 'b';
    if (mm(path, pattern) !== false) process.exit(1);
    if (mm.makeRe(pattern).test(path) !== false) process.exit(2);
  `], { cwd: new URL("..", import.meta.url), timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr?.toString());
});

test("keeps ESLint source selection, ignores, and React/import rules working", async () => {
  const eslint = new ESLint();
  assert.equal(await eslint.isPathIgnored(".next/server/app.js"), true);
  assert.equal(await eslint.isPathIgnored("src/app/page.tsx"), false);
  const config = await eslint.calculateConfigForFile("src/app/page.tsx");
  assert.ok(config.rules["@next/next/no-img-element"]);
  assert.ok(config.rules["@typescript-eslint/no-explicit-any"]);

  const strict = new ESLint({ overrideConfig: [{
    files: ["**/*.tsx"],
    rules: {
      "react/jsx-pascal-case": ["error", { ignore: ["legacy_*"] }],
      "import/no-internal-modules": ["error", { forbid: ["blocked/**"] }],
    },
  }] });
  const [allowed] = await strict.lintText(
    'import { value } from "@/lib/data"; export default function Demo() { return <legacy_widget>{value}</legacy_widget>; }',
    { filePath: "src/glob-compat-fixture.tsx" },
  );
  assert.equal(allowed.messages.filter(m => ["react/jsx-pascal-case", "import/no-internal-modules"].includes(m.ruleId)).length, 0);
  const [denied] = await strict.lintText(
    'import { value } from "blocked/internal"; export default function Demo() { return <Wrong_name>{value}</Wrong_name>; }',
    { filePath: "src/glob-compat-fixture.tsx" },
  );
  assert.ok(denied.messages.some(m => m.ruleId === "react/jsx-pascal-case"));
  assert.ok(denied.messages.some(m => m.ruleId === "import/no-internal-modules"));
});
