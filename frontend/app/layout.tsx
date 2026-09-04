export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

// Self-hosted rather than next/font/google: that fetches from fonts.gstatic.com during the
// build, which fails on a machine whose Docker build has no egress to it. Serving is
// unchanged — next/font already hosted these from our own origin — but the build no longer
// depends on the network, and there is one fewer external origin to declare for MiniPay.
const displayFont = localFont({
  src: [{ path: "./fonts/BricolageGrotesque.woff2", weight: "600 800", style: "normal" }],
  variable: "--font-display",
  display: "swap",
});

const uiFont = localFont({
  src: [{ path: "./fonts/HankenGrotesk.woff2", weight: "400 800", style: "normal" }],
  variable: "--font-ui",
  display: "swap",
});

const monoFont = localFont({
  src: [
    { path: "./fonts/SpaceMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/SpaceMono-Bold.woff2",    weight: "700", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://playlexiq.xyz"),
  title: "Lexiq — 90-second word race on Celo",
  description:
    "Build as many words as you can from 7 random letters. Free to play — climb the weekly board and share the prize pool.",
  openGraph: {
    title: "Lexiq — 90-second word race on Celo",
    description: "Build as many words as you can from 7 random letters. Free to play — climb the weekly board and share the prize pool.",
    url: "https://playlexiq.xyz",
    siteName: "Lexiq",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lexiq — 90-second word race on Celo",
    description: "Build as many words as you can from 7 random letters.",
    site: "@playlexiq",
  },
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
