import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const src = path.join(projectRoot, "node_modules", "qrcode-generator", "dist", "qrcode.js");
const outDir = path.join(projectRoot, "src", "assets", "vendor");
const out = path.join(outDir, "qrcode.js");

await fs.mkdir(outDir, { recursive: true });
await fs.copyFile(src, out);

console.log(`Copied vendor qrcode-generator -> ${path.relative(projectRoot, out)}`);
