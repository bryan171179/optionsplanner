import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const publicDir = path.resolve("public");
const sourcePath = path.join(publicDir, "icon.svg");

const targets = [
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
];

async function generateIcons() {
  const svgBuffer = await fs.readFile(sourcePath);

  await Promise.all(
    targets.map(async ({ file, size }) => {
      const outputPath = path.join(publicDir, file);

      await sharp(svgBuffer)
        .resize(size, size)
        .png({ compressionLevel: 9 })
        .toFile(outputPath);

      console.log(`Generated ${path.relative(process.cwd(), outputPath)} (${size}x${size})`);
    }),
  );
}

generateIcons().catch((error) => {
  console.error("Failed to generate icon PNG files:", error);
  process.exitCode = 1;
});
