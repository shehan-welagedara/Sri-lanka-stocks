import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { AppShell } from "@/components/app";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: { default: `${site.name} — ${site.tagline}`, template: `%s · ${site.name}` },
  description: "Colombo Stock Exchange prices, charts, portfolios and the investor community of Sri Lanka in one app.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: site.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f4f5f7" }, { media: "(prefers-color-scheme: dark)", color: "#0c0c0e" }],
};

// Applies the saved theme before paint so there is no flash.
const themeScript = `try{var p=JSON.parse(localStorage.getItem("ls.prefs")||"{}");if(p.theme==="dark"||p.theme==="light")document.documentElement.setAttribute("data-theme",p.theme)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
