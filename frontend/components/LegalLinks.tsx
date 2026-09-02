"use client";

// MiniPay requires a support channel reachable from inside the Mini App, and a 24h
// response on critical issues. This inbox must stay monitored to keep the listing.
const SUPPORT_URL = "mailto:contact@playlexiq.xyz";

const linkStyle: React.CSSProperties = { color: "inherit", textDecoration: "none" };

/** Terms / Privacy / Support links — required by MiniPay to be reachable in-app. */
export default function LegalLinks({ align = "center" }: { align?: "center" | "left" }) {
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#6E6557", display: "flex", gap: 8, justifyContent: align === "center" ? "center" : "flex-start", padding: "8px 0" }}>
      <a href="/terms" style={linkStyle}>Terms</a>
      <span>·</span>
      <a href="/privacy" style={linkStyle}>Privacy</a>
      <span>·</span>
      <a href={SUPPORT_URL} style={linkStyle}>Support</a>
    </div>
  );
}
