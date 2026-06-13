import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Lexiq",
  description: "Real-time head-to-head word race on Celo.",
  other: {
    "talentapp:project_verification": "d90c99e9041df8cf32e67e04cc18a873b301515b08f9b8a1910ac9a1431edde6fc83e90256f4b6da01aaa56b059f02f0e43a6ab20a130beee233fdc7943551b7",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}
