/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        hud: {
          bg: "#0a0e14",
          panel: "#10151c",
          panel2: "#161c25",
          border: "#1f2733",
          text: "#cdd6e4",
          dim: "#6b7689",
          accent: "#ff5d5d",
          accent2: "#ffb547",
          good: "#5dd2a3",
          info: "#5db5ff",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(255, 93, 93, 0.15)",
      },
    },
  },
  plugins: [],
};
