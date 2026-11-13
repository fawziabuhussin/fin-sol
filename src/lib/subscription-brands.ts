/**
 * Visual identity for subscription rows: a coloured monogram tile. Popular
 * services get a recognisable colour; everything else gets a stable colour
 * derived from its name. (Text + colour only — no third-party logos.)
 */

type Brand = { match: RegExp; name: string; color: string; fg?: string };

const BRANDS: Brand[] = [
  { match: /netflix/i, name: "Netflix", color: "#E50914" },
  { match: /spotify/i, name: "Spotify", color: "#1DB954" },
  { match: /youtube/i, name: "YouTube Premium", color: "#FF0033" },
  { match: /disney/i, name: "Disney+", color: "#113CCF" },
  { match: /prime|amazon/i, name: "Amazon Prime", color: "#00A8E1" },
  { match: /icloud|apple/i, name: "iCloud+", color: "#111827" },
  { match: /google ?(one|drive)|^google$/i, name: "Google One", color: "#1A73E8" },
  { match: /chat ?gpt|openai/i, name: "ChatGPT Plus", color: "#10A37F" },
  { match: /claude|anthropic/i, name: "Claude Pro", color: "#D97757" },
  { match: /github/i, name: "GitHub", color: "#24292F" },
  { match: /microsoft|office|365/i, name: "Microsoft 365", color: "#D83B01" },
  { match: /adobe/i, name: "Adobe", color: "#FA0F00" },
  { match: /vercel/i, name: "Vercel", color: "#000000" },
  { match: /notion/i, name: "Notion", color: "#191919" },
  { match: /canva/i, name: "Canva", color: "#00C4CC" },
  { match: /dropbox/i, name: "Dropbox", color: "#0061FF" },
  { match: /overleaf/i, name: "Overleaf", color: "#138A07" },
  { match: /fitness|gym|نادي|جيم/i, name: "نادي رياضي", color: "#F97316" },
  { match: /פלאפון|סלקום|פרטנר|hot|cellcom|partner|جوال|هاتف/i, name: "خط هاتف", color: "#0EA5E9" },
  { match: /ביטוח|تأمين|insurance|aig/i, name: "تأمين", color: "#0F766E" },
  { match: /internet|انترنت|إنترنت|bezeq|בזק/i, name: "إنترنت", color: "#6366F1" },
];

const PALETTE = [
  "#4F46E5", "#0891B2", "#059669", "#D97706", "#DB2777",
  "#7C3AED", "#2563EB", "#0D9488", "#EA580C", "#9333EA",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function subscriptionVisual(title: string) {
  const brand = BRANDS.find((b) => b.match.test(title));
  const color = brand?.color ?? PALETTE[hash(title.trim().toLowerCase()) % PALETTE.length]!;
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "؟";
  // Two Latin initials read well ("CP"); Arabic/Hebrew look best as one letter.
  const second = /^[A-Za-z]/.test(first) && words[1] && /^[A-Za-z]/.test(words[1]) ? words[1][0] : "";
  return { color, initials: `${first}${second}`.toUpperCase() };
}

/** One-tap presets for the "new subscription" form. */
export const POPULAR_SERVICES = [
  "Netflix",
  "Spotify",
  "YouTube Premium",
  "iCloud+",
  "Google One",
  "ChatGPT Plus",
  "Claude Pro",
  "Microsoft 365",
  "Disney+",
  "Amazon Prime",
  "نادي رياضي",
  "خط هاتف",
  "إنترنت",
  "تأمين",
];
