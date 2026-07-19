"use client";
import { motion } from "framer-motion";

const SIZES = {
  sm: { w: 24, h: 28, r: 5,  lf: 16, sub: 6,  gap: 10, wf: 18, qw: 18, qh: 21, qr: 4, qf: 14 },
  md: { w: 28, h: 32, r: 6,  lf: 18, sub: 7,  gap: 11, wf: 20, qw: 20, qh: 24, qr: 5, qf: 16 },
};

export default function Logo({ size = "sm" }: { size?: "sm" | "md" }) {
  const s = SIZES[size];

  const tileContent = (
    <div style={{ position: "relative", width: s.w, height: s.h, borderRadius: s.r, background: "#F3ECDB", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: s.lf, color: "#2A2017", boxShadow: "inset 0 -2px 0 #CFC1A6", flexShrink: 0 }}>
      L
      <span style={{ position: "absolute", right: 3, bottom: 2, fontFamily: "var(--font-mono)", fontSize: s.sub, fontWeight: 700, color: "#A9C931", lineHeight: 1 }}>7</span>
    </div>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: s.gap }}>
      <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 3.0, repeat: Infinity, ease: "easeInOut" }}>
        {tileContent}
      </motion.div>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: s.wf, color: "#F5EFE2", letterSpacing: "-0.02em" }}>lexi</span>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: s.qw, height: s.qh, marginLeft: 2, borderRadius: s.qr, background: "#CFE94B", boxShadow: "inset 0 -2px 0 #A9C931", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: s.qf, color: "#15110D", transform: "translateY(0.06em)" }}>q</span>
      </div>
    </div>
  );
}
