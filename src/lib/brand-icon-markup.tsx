/** Shared Fin$ol mark for favicon / PWA icon generation (next/og ImageResponse). */
export function BrandIconSvg({ size = 120 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M19 6 V42"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M19 14 H36"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M19 25 H31"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M30 10 H13"
        stroke="white"
        strokeOpacity="0.45"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function brandIconImageResponse(
  width: number,
  height: number,
  radius: number
) {
  const mark = Math.round(Math.min(width, height) * 0.52);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
        borderRadius: radius,
      }}
    >
      <BrandIconSvg size={mark} />
    </div>
  );
}
