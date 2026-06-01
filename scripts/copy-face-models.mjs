import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function copyDir(src, dest, label) {
  if (!existsSync(src)) {
    console.error(`Missing ${label} at ${src}. Run npm install first.`);
    process.exit(1);
  }
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    if (name.endsWith(".wasm") || name.endsWith(".js")) {
      cpSync(join(src, name), join(dest, name), { force: true });
    }
  }
  console.log(`Copied ${label} to ${dest}`);
}

const faceSrc = join(root, "node_modules", "@vladmandic", "face-api", "model");
const faceDest = join(root, "public", "models");
mkdirSync(faceDest, { recursive: true });
if (!existsSync(faceSrc)) {
  console.error("Missing @vladmandic/face-api model folder. Run npm install first.");
  process.exit(1);
}
for (const name of readdirSync(faceSrc)) {
  cpSync(join(faceSrc, name), join(faceDest, name), { force: true });
}
console.log(`Copied face models to ${faceDest}`);

const wasmSrc = join(root, "node_modules", "@tensorflow", "tfjs-backend-wasm", "dist");
copyDir(wasmSrc, join(root, "public", "tfjs-wasm"), "tfjs WASM binaries");
