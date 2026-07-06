"use client";
import { useEffect, useRef, useState } from "react";

export function useScrollReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/** Inline style helper — fades + slides an element in when `visible` is true. */
export function revealStyle(visible: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "none" : "translateY(20px)",
    transition: visible
      ? `opacity 0.55s cubic-bezier(0.2,1,0.4,1) ${delay}s, transform 0.55s cubic-bezier(0.2,1,0.4,1) ${delay}s`
      : "none",
  };
}
