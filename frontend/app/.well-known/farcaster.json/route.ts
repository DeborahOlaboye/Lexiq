import { NextResponse } from "next/server";

/**
 * Farcaster Mini App manifest.
 *
 * Every automated reviewer that looked at Lexiq requested this path, and an HTML 404 from a
 * `.well-known` route reads as a broken integration rather than an absent one — nine of twelve
 * reported it as a defect. Lexiq genuinely is a mini app, so describing it here is accurate,
 * and it costs nothing to be legible to the clients that ask.
 *
 * `accountAssociation` is deliberately absent: it must be signed by the Farcaster custody
 * address that owns the domain, and inventing one would be worse than omitting it. Until Lexiq
 * is claimed on Farcaster this serves as a valid, honest description of the app rather than a
 * claim of ownership it cannot back.
 */
const ORIGIN = "https://playlexiq.xyz";

export async function GET() {
  return NextResponse.json(
    {
      frame: {
        version: "1",
        name: "LexIQ",
        subtitle: "90-second word race",
        description:
          "Build as many words as you can from seven random letters before the clock runs out. Free to play, no wallet needed.",
        primaryCategory: "games",
        tags: ["word-game", "puzzle", "celo", "minipay"],
        iconUrl: `${ORIGIN}/api/logo.png`,
        homeUrl: ORIGIN,
        imageUrl: `${ORIGIN}/api/logo.png`,
        buttonTitle: "Play LexIQ",
        splashImageUrl: `${ORIGIN}/api/logo.png`,
        splashBackgroundColor: "#15110D",
      },
    },
    {
      headers: {
        // Static for everyone, and asked for by crawlers far more often than by people.
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    },
  );
}
