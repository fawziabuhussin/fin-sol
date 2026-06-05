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

/** Branded splash screen for iOS LaunchScreen (square, scaleAspectFill). */
export function splashImageResponse(size: number) {
  const logo = Math.round(size * 0.18);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: size * 0.04,
        background: "linear-gradient(145deg, #4F46E5 0%, #6D28D9 50%, #7C3AED 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: logo * 1.55,
          height: logo * 1.55,
          borderRadius: logo * 0.32,
          background: "rgba(255,255,255,0.14)",
        }}
      >
        <BrandIconSvg size={logo} />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          color: "white",
        }}
      >
        <span
          style={{
            fontSize: logo * 0.42,
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          Fin$ol
        </span>
        <span
          style={{
            fontSize: logo * 0.18,
            opacity: 0.85,
            marginTop: logo * 0.06,
          }}
        >
          Smart Finance
        </span>
      </div>
    </div>
  );
}

/** App Store icons must be square with no transparent pixels (Apple applies the mask). */
export function brandIconImageResponse(
  width: number,
  height: number,
  options?: { square?: boolean }
) {
  const square = options?.square ?? true;
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
        borderRadius: square ? 0 : Math.round(Math.min(width, height) * 0.22),
      }}
    >
      <BrandIconSvg size={mark} />
    </div>
  );
}
