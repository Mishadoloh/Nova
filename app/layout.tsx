import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "NOVA — твій фокус-кокпіт",
  description: "Таймер, головні задачі та простір для глибокої роботи без зайвого шуму.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "NOVA — твій фокус-кокпіт",
    description: "Злови ритм. Зроби важливе.",
    type: "website",
    locale: "uk_UA",
    images: [{ url: "/og.png", width: 1792, height: 928, alt: "NOVA — злови ритм, зроби важливе" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NOVA — твій фокус-кокпіт",
    description: "Злови ритм. Зроби важливе.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="uk"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
