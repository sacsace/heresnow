import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "@vladmandic", "face-api", "model");
const dest = join(root, "public", "models");

if (!existsSync(src)) {
  console.error("Missing @vladmandic/face-api model folder. Run npm install first.");
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
for (const name of readdirSync(src)) {
  cpSync(join(src, name), join(dest, name), { force: true });
}
console.log(`Copied face models to ${dest}`);
