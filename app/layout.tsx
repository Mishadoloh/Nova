import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./animations.css";
import { GlobalTools } from "./components/GlobalTools";
import { AuthGate } from "./components/AuthGate";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "NOVA — твій фокус-кокпіт",
  description: "Розумний Pomodoro, проєкти, атмосферні звуки, статистика та синхронізація фокусу між пристроями.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "NOVA — твій фокус-кокпіт",
    description: "Твій ритм. Твої перемоги.",
    type: "website",
    locale: "uk_UA",
    images: [{ url: "/og-v2.png", width: 1792, height: 928, alt: "NOVA — твій ритм, твої перемоги" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NOVA — твій фокус-кокпіт",
    description: "Твій ритм. Твої перемоги.",
    images: ["/og-v2.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#090c0a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="uk"><body className={`${geistSans.variable} ${geistMono.variable}`}><AuthGate>{children}<GlobalTools /></AuthGate></body></html>;
}
