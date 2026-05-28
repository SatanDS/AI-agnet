import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1f2933",
        mist: "#f6f8fb",
        line: "#d9e2ec",
        brand: "#0f766e",
        coral: "#c2410c",
      },
      boxShadow: {
        soft: "0 12px 40px rgba(31, 41, 51, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
