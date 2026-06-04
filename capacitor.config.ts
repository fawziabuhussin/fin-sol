import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl =
  process.env.CAPACITOR_SERVER_URL ?? "https://fin-sol-pied.vercel.app";

const config: CapacitorConfig = {
  appId: "com.finsol.app",
  appName: "Fin$ol",
  webDir: "ios-www",
  server: {
    url: serverUrl,
    cleartext: false,
    allowNavigation: [serverUrl.replace(/^https:\/\//, ""), "fin-sol-pied.vercel.app"],
  },
  ios: {
    contentInset: "automatic",
    scrollEnabled: true,
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#4F46E5",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#4F46E5",
    },
  },
};

export default config;
