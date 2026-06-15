import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#15110D",
        ink2: "#1E1710",
        panel: "#241C13",
        panel2: "#2F2517",
        cream: "#F5EFE2",
        creamdim: "#CBC0AE",
        muted: "#9A8C77",
        muted2: "#6E6557",
        tile: "#F3ECDB",
        tileedge: "#CFC1A6",
        tileink: "#2A2017",
        lime: "#CFE94B",
        limedeep: "#A9C931",
        coral: "#FF5B45",
        coraldeep: "#E2402A",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        ui: ["var(--font-ui)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
