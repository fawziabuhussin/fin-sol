import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { NativeShell } from "@/components/capacitor/native-shell";
import "./globals.css";

const plex = IBM_Plex_Sans_Arabic({
  variable: "--font-plex",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Fin$ol — المالية الذكية",
    template: "%s | Fin$ol",
  },
  description:
    "تابع دخلك ومصروفاتك واشتراكاتك وادخارك في مكان واحد — واضح، آمن، وبالعربية.",
  applicationName: "Fin$ol",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fin$ol",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F6F8" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1220" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${plex.variable} h-full antialiased`}>
      <body className="min-h-full overflow-x-hidden bg-background text-foreground">
        <NativeShell />
        {children}
      </body>
    </html>
  );
}
