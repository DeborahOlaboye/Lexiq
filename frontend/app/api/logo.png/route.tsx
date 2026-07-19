import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 360,
          height: 180,
          background: "#15110D",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
        }}
      >
        {/* Lime Q tile icon */}
        <div
          style={{
            position: "relative",
            width: 64,
            height: 72,
            display: "flex",
          }}
        >
          {/* tile edge (darker bottom) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#A9C931",
              borderRadius: 16,
            }}
          />
          {/* tile face */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 58,
              background: "#CFE94B",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 38,
                fontWeight: 800,
                color: "#15110D",
                lineHeight: 1,
                fontFamily: "sans-serif",
              }}
            >
              Q
            </span>
          </div>
        </div>

        {/* Wordmark */}
        <span
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "#F5EFE2",
            letterSpacing: "-0.02em",
            fontFamily: "sans-serif",
            lineHeight: 1,
          }}
        >
          Lexiq
        </span>
      </div>
    ),
    { width: 360, height: 180 }
  );
}
