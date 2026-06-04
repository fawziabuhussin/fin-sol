/**
 * Generate iOS AppIcon.appiconset PNGs from Fin$ol brand mark.
 * Run after `npx cap add ios`: npm run generate:ios-icons
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { brandIconImageResponse } from "../src/lib/brand-icon-markup";

const ICONS: { name: string; size: number; idiom: string; scale: string; sizeLabel: string }[] = [
  { name: "Icon-20@2x.png", size: 40, idiom: "iphone", scale: "2x", sizeLabel: "20x20" },
  { name: "Icon-20@3x.png", size: 60, idiom: "iphone", scale: "3x", sizeLabel: "20x20" },
  { name: "Icon-29@2x.png", size: 58, idiom: "iphone", scale: "2x", sizeLabel: "29x29" },
  { name: "Icon-29@3x.png", size: 87, idiom: "iphone", scale: "3x", sizeLabel: "29x29" },
  { name: "Icon-40@2x.png", size: 80, idiom: "iphone", scale: "2x", sizeLabel: "40x40" },
  { name: "Icon-40@3x.png", size: 120, idiom: "iphone", scale: "3x", sizeLabel: "40x40" },
  { name: "Icon-60@2x.png", size: 120, idiom: "iphone", scale: "2x", sizeLabel: "60x60" },
  { name: "Icon-60@3x.png", size: 180, idiom: "iphone", scale: "3x", sizeLabel: "60x60" },
  { name: "Icon-1024.png", size: 1024, idiom: "ios-marketing", scale: "1x", sizeLabel: "1024x1024" },
];

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

  for (const icon of ICONS) {
    const radius = Math.round(icon.size * 0.22);
    const res = await new ImageResponse(
      brandIconImageResponse(icon.size, icon.size, radius),
      { width: icon.size, height: icon.size }
    );
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(join(outDir, icon.name), buf);
    console.log(`  ${icon.name} (${icon.size}px)`);
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
