import { ImageResponse } from "next/og";
import { brandIconImageResponse } from "@/lib/brand-icon-markup";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(brandIconImageResponse(180, 180, 40), {
    ...size,
  });
}
