/**
 * Write public/favicon.ico from brand PNG (for browsers that only request /favicon.ico).
 * Usage: npx tsx scripts/generate-favicons.ts
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { brandIconImageResponse } from "../src/lib/brand-icon-markup";

async function main() {
  const sizes = [16, 32, 48] as const;
  const pngs: Buffer[] = [];

  for (const size of sizes) {
    const res = await new ImageResponse(
      brandIconImageResponse(size, size, Math.round(size * 0.22)),
      { width: size, height: size }
    );
    pngs.push(Buffer.from(await res.arrayBuffer()));
  }

  const ico = encodeIco(pngs, sizes);
  const out = join(process.cwd(), "public", "favicon.ico");
  await writeFile(out, ico);
  console.log(`Wrote ${out} (${ico.length} bytes)`);
}

/** Minimal ICO container for PNG-embedded icons (Vista+). */
function encodeIco(images: Buffer[], sizes: readonly number[]) {
  const count = images.length;
  const header = 6 + count * 16;
  let offset = header;
  const entries: Buffer[] = [];

  for (let i = 0; i < count; i++) {
    const size = sizes[i]!;
    const img = images[i]!;
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += img.length;
  }

  return Buffer.concat([
    Buffer.from([0, 0, 1, 0, count, 0]),
    ...entries,
    ...images,
  ]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
