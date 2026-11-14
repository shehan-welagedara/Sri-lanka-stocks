import type { CapacitorConfig } from "@capacitor/cli";

// The Android app is a native shell around the hosted web app, so one deploy
// updates web and Android together. Set CAP_SERVER_URL to the production URL
// (e.g. https://yourdomain.lk) before running `npx cap add android`.
const config: CapacitorConfig = {
  appId: "lk.lankastocks.app",
  appName: "LankaStocks",
  webDir: "public",
  server: {
    url: process.env.CAP_SERVER_URL || "http://10.0.2.2:3000",
    cleartext: !process.env.CAP_SERVER_URL,
  },
  android: { backgroundColor: "#F4F5F7" },
};

export default config;
