/** Adds Node.js + force-dynamic segment config to all app/api route.ts files. */
import fs from "node:fs";
import path from "node:path";

const SEGMENT = `export const runtime = "nodejs";
export const dynamic = "force-dynamic";

`;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

const root = path.join(process.cwd(), "app", "api");
let patched = 0;

for (const file of walk(root)) {
  let src = fs.readFileSync(file, "utf8");
  if (src.includes('export const dynamic = "force-dynamic"')) continue;
  if (src.includes("export const runtime = ")) {
    src = src.replace(
      /export const runtime = "[^"]+";?\n/,
      SEGMENT
    );
  } else {
    src = SEGMENT + src;
  }
  fs.writeFileSync(file, src);
  patched++;
  console.log("patched", path.relative(process.cwd(), file));
}

console.log(`Done. ${patched} route(s) updated.`);
