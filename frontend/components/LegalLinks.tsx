"use client";

// TODO: replace with your real support channel (Telegram, WhatsApp, email, or a web portal).
const SUPPORT_URL = "mailto:support@lexiq.app";

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
