import { ImageResponse } from "next/og";
import { brandIconImageResponse } from "@/lib/brand-icon-markup";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(brandIconImageResponse(32, 32, 8), {
    ...size,
  });
}
