// Fails when a module in app/modules/ ships without tests. Each module needs a
// tests/ folder with at least one *.test.ts(x) file, which tests it through its
// entry points (app/modules/README.md).
// Usage: node scripts/check-module-tests.js

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MODULES = "app/modules";

const hasTest = (dir) =>
  existsSync(dir) &&
  readdirSync(dir, { recursive: true }).some((file) =>
    /\.test\.tsx?$/.test(String(file))
  );

const untested = readdirSync(MODULES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => !hasTest(join(MODULES, name, "tests")));

if (untested.length > 0) {
  console.error("These modules have no tests:\n");
  for (const name of untested) console.error(`  ${MODULES}/${name}/`);
  console.error(`
Add app/modules/<name>/tests/<name>.test.ts that calls the module through its
entry points (index.ts, index.server.ts). See app/modules/README.md.`);
  process.exit(1);
}
