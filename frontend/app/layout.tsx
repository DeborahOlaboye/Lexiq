export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const uiFont = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-ui",
  display: "swap",
});

const monoFont = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lexiq — 90-second word race on Celo",
  description:
    "Build as many words as you can from 7 random letters. Stake USDM, beat your best, and climb the weekly prize board.",
  other: {
    "talentapp:project_verification":
      "d90c99e9041df8cf32e67e04cc18a873b301515b08f9b8a1910ac9a1431edde6fc83e90256f4b6da01aaa56b059f02f0e43a6ab20a130beee233fdc7943551b7",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${uiFont.variable} ${monoFont.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
