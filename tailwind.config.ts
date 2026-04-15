import type { Config } from "tailwindcss";

const config: Config = {
  content:[
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cs: {
          green: "#138946",
          dark: "#0d0807",
          gold: "#C5A059",
        },
        background: "#0d0807",
        surface: "#1a1413",
        text: {
          primary: "#ffffff",
          secondary: "#a19d9c",
        }
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;