/**
 * Generate iOS AppIcon.appiconset PNGs from Fin$ol brand mark.
 * Run after `npx cap add ios`: npm run generate:ios-icons
 */
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { brandIconImageResponse } from "../src/lib/brand-icon-markup";

const ICONS: {
  name: string;
  size: number;
  idiom: string;
  scale: string;
  sizeLabel: string;
}[] = [
  // iPhone
  { name: "Icon-20@2x.png", size: 40, idiom: "iphone", scale: "2x", sizeLabel: "20x20" },
  { name: "Icon-20@3x.png", size: 60, idiom: "iphone", scale: "3x", sizeLabel: "20x20" },
  { name: "Icon-29@2x.png", size: 58, idiom: "iphone", scale: "2x", sizeLabel: "29x29" },
  { name: "Icon-29@3x.png", size: 87, idiom: "iphone", scale: "3x", sizeLabel: "29x29" },
  { name: "Icon-40@2x.png", size: 80, idiom: "iphone", scale: "2x", sizeLabel: "40x40" },
  { name: "Icon-40@3x.png", size: 120, idiom: "iphone", scale: "3x", sizeLabel: "40x40" },
  { name: "Icon-60@2x.png", size: 120, idiom: "iphone", scale: "2x", sizeLabel: "60x60" },
  { name: "Icon-60@3x.png", size: 180, idiom: "iphone", scale: "3x", sizeLabel: "60x60" },
  // iPad
  { name: "Icon-20~ipad.png", size: 20, idiom: "ipad", scale: "1x", sizeLabel: "20x20" },
  { name: "Icon-20@2x~ipad.png", size: 40, idiom: "ipad", scale: "2x", sizeLabel: "20x20" },
  { name: "Icon-29~ipad.png", size: 29, idiom: "ipad", scale: "1x", sizeLabel: "29x29" },
  { name: "Icon-29@2x~ipad.png", size: 58, idiom: "ipad", scale: "2x", sizeLabel: "29x29" },
  { name: "Icon-40~ipad.png", size: 40, idiom: "ipad", scale: "1x", sizeLabel: "40x40" },
  { name: "Icon-40@2x~ipad.png", size: 80, idiom: "ipad", scale: "2x", sizeLabel: "40x40" },
  { name: "Icon-76~ipad.png", size: 76, idiom: "ipad", scale: "1x", sizeLabel: "76x76" },
  { name: "Icon-76@2x~ipad.png", size: 152, idiom: "ipad", scale: "2x", sizeLabel: "76x76" },
  { name: "Icon-83.5@2x~ipad.png", size: 167, idiom: "ipad", scale: "2x", sizeLabel: "83.5x83.5" },
  // App Store
  { name: "Icon-1024.png", size: 1024, idiom: "ios-marketing", scale: "1x", sizeLabel: "1024x1024" },
];

/** Flatten PNG onto brand purple — App Store rejects alpha on 1024 icon. */
async function toOpaquePng(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .flatten({ background: { r: 79, g: 70, b: 229 } })
    .png({ compressionLevel: 9, force: true })
    .toBuffer();
}

async function main() {
  const outDir = join(
    process.cwd(),
    "ios",
    "App",
    "App",
    "Assets.xcassets",
    "AppIcon.appiconset"
  );
  await mkdir(outDir, { recursive: true });

  const keep = new Set(ICONS.map((i) => i.name));
  for (const file of await readdir(outDir)) {
    if (file.endsWith(".png") && !keep.has(file)) {
      await unlink(join(outDir, file));
      console.log(`  removed orphan ${file}`);
    }
  }

  for (const icon of ICONS) {
    const res = await new ImageResponse(
      brandIconImageResponse(icon.size, icon.size, { square: true }),
      { width: icon.size, height: icon.size }
    );
    const raw = Buffer.from(await res.arrayBuffer());
    const opaque = await toOpaquePng(raw);
    await writeFile(join(outDir, icon.name), opaque);
    console.log(`  ${icon.name} (${icon.size}px, opaque)`);
  }

  const contents = {
    images: ICONS.map((icon) => ({
      filename: icon.name,
      idiom: icon.idiom,
      scale: icon.scale,
      size: icon.sizeLabel,
    })),
    info: { author: "xcode", version: 1 },
  };

  await writeFile(join(outDir, "Contents.json"), JSON.stringify(contents, null, 2));
  console.log(`App icons written to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
