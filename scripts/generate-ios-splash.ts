/**
 * Generate branded iOS splash images (replaces default Capacitor splash).
 * Run: npm run generate:ios-splash
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { splashImageResponse } from "../src/lib/brand-icon-markup";

async function splashImage(size: number) {
  const res = await new ImageResponse(splashImageResponse(size), {
    width: size,
    height: size,
  });
  const raw = Buffer.from(await res.arrayBuffer());
  return sharp(raw).flatten({ background: { r: 79, g: 70, b: 229 } }).png().toBuffer();
}

async function main() {
  const outDir = join(
    process.cwd(),
    "ios",
    "App",
    "App",
    "Assets.xcassets",
    "Splash.imageset"
  );

  const sizes = [
    { name: "splash-2732x2732.png", size: 2732 },
    { name: "splash-2732x2732-1.png", size: 1366 },
    { name: "splash-2732x2732-2.png", size: 912 },
  ];

  for (const { name, size } of sizes) {
    const buf = await splashImage(size);
    await writeFile(join(outDir, name), buf);
    console.log(`  ${name} (${size}px)`);
  }

  console.log(`Splash images written to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
