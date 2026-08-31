const fs = require("node:fs");
const path = require("node:path");

for (const packageName of ["avataaars", "react-dom17"]) {
  const root = path.resolve(__dirname, "..", "node_modules", packageName);
  if (!fs.existsSync(root)) continue;
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(file);
      if (!entry.isFile() || !/\.(?:js|mjs|cjs)$/.test(entry.name)) continue;
      const before = fs.readFileSync(file, "utf8");
      const after = before
        .replaceAll('require("react")', 'require("react17")')
        .replaceAll("require('react')", "require('react17')");
      if (after !== before) fs.writeFileSync(file, after);
    }
  }
}
