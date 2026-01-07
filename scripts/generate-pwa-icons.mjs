import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const publicDir = path.join(repoRoot, "public");

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function generatePngsFromSvg(svgPath, outputs) {
  if (!(await fileExists(svgPath))) {
    console.warn(`[pwa-icons] skip: missing ${path.relative(repoRoot, svgPath)}`);
    return;
  }

  const svgBuffer = await fs.readFile(svgPath);

  for (const out of outputs) {
    const outPath = path.join(publicDir, out.file);
    await sharp(svgBuffer, { density: 512 })
      .resize(out.size, out.size)
      .png({ compressionLevel: 9 })
      .toFile(outPath);

    console.log(`[pwa-icons] generated ${path.relative(repoRoot, outPath)}`);
  }
}

async function main() {
  await fs.mkdir(publicDir, { recursive: true });

  const iconSvg = path.join(publicDir, "icon.svg");
  const maskableSvg = path.join(publicDir, "maskable-icon.svg");

  await generatePngsFromSvg(iconSvg, [
    { file: "pwa-192x192.png", size: 192 },
    { file: "pwa-512x512.png", size: 512 },
    { file: "apple-touch-icon.png", size: 180 },
  ]);

  await generatePngsFromSvg(maskableSvg, [
    { file: "maskable-192x192.png", size: 192 },
    { file: "maskable-512x512.png", size: 512 },
  ]);
}

main().catch((err) => {
  console.error("[pwa-icons] failed:", err);
  process.exitCode = 1;
});
