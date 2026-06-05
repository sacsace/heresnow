import { cpSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
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

/** 런타임에 실제로 로드하는 3종만 public/models 에 복사 */
const REQUIRED_FACE_MODEL_PREFIXES = [
  "tiny_face_detector_model",
  "face_landmark_68_tiny_model",
  "face_recognition_model",
];

const faceSrc = join(root, "node_modules", "@vladmandic", "face-api", "model");
const faceDest = join(root, "public", "models");
mkdirSync(faceDest, { recursive: true });
if (!existsSync(faceSrc)) {
  console.error("Missing @vladmandic/face-api model folder. Run npm install first.");
  process.exit(1);
}

if (existsSync(faceDest)) {
  for (const name of readdirSync(faceDest)) {
    const keep = REQUIRED_FACE_MODEL_PREFIXES.some((prefix) => name.startsWith(prefix));
    if (!keep) {
      unlinkSync(join(faceDest, name));
      console.log(`Removed unused model file: ${name}`);
    }
  }
}

let copied = 0;
for (const name of readdirSync(faceSrc)) {
  const keep = REQUIRED_FACE_MODEL_PREFIXES.some((prefix) => name.startsWith(prefix));
  if (!keep) continue;
  cpSync(join(faceSrc, name), join(faceDest, name), { force: true });
  copied += 1;
}
console.log(`Copied ${copied} face model file(s) to ${faceDest}`);

const wasmSrc = join(root, "node_modules", "@tensorflow", "tfjs-backend-wasm", "dist");
copyDir(wasmSrc, join(root, "public", "tfjs-wasm"), "tfjs WASM binaries");
