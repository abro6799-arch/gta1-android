#!/usr/bin/env node
// Fetches js-dos (DOSBox in WebAssembly) and JSZip from npm and copies the
// files the app needs into app/src/main/assets/web/vendor.
// Run once before building:  node scripts/fetch-deps.js
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const tmp = path.join(root, "_deps");
const out = path.join(root, "app/src/main/assets/web/vendor");

fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
fs.mkdirSync(out, { recursive: true });

fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "deps", private: true }));
execSync("npm install --no-audit --no-fund js-dos@8 emulators@8 jszip@3", {
  cwd: tmp,
  stdio: "inherit",
});

const nm = path.join(tmp, "node_modules");
function copy(from, to) {
  if (!fs.existsSync(from)) throw new Error("Expected file not found: " + from);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log("copied", path.relative(root, to));
}

// js-dos UI (v8)
copy(path.join(nm, "js-dos/dist/js-dos.js"), path.join(out, "js-dos.js"));
copy(path.join(nm, "js-dos/dist/js-dos.css"), path.join(out, "js-dos.css"));

// DOSBox WASM backends. Everything in emulators/dist is needed at runtime.
const emuDist = path.join(nm, "emulators/dist");
for (const f of fs.readdirSync(emuDist)) {
  if (/\.(js|wasm)$/.test(f)) copy(path.join(emuDist, f), path.join(out, "emulators", f));
}

// JSZip
copy(path.join(nm, "jszip/dist/jszip.min.js"), path.join(out, "jszip.min.js"));

fs.rmSync(tmp, { recursive: true, force: true });
console.log("\nDone. You can now build the app.");
