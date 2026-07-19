const SIZES = {
  sm: { icon: 32, font: 20 },
  md: { icon: 36, font: 23 },
};

export default function Logo({ size = "sm" }: { size?: "sm" | "md" }) {
  const s = SIZES[size];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <svg width={s.icon} height={s.icon} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="15" fill="#15110D"/>
        <rect x="10" y="8" width="44" height="48" rx="11" fill="#A9C931"/>
        <rect x="10" y="8" width="44" height="39" rx="11" fill="#CFE94B"/>
        <path d="M38 35 L44 41.5 L40.2 44.5 L35.5 39 Z" fill="#15110D"/>
        <circle cx="32" cy="27" r="12" fill="none" stroke="#15110D" strokeWidth="6.2"/>
      </svg>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: s.font, letterSpacing: "-0.01em", color: "#F5EFE2" }}>Lexiq</span>
    </div>
  );
}
