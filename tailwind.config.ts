import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Times New Roman", "Times", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
