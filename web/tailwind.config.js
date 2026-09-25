/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Vazirmatn", "Tahoma", "sans-serif"],
      },
      colors: {
        paper: "#F5F3EE",
        paper2: "#EDEAE2",
        ink: "#16211F",
        inkmuted: "#5B655F",
        line: "#DEDAD0",
        pine: {
          DEFAULT: "#0F6B5C",
          dark: "#0B4F44",
          light: "#E4F0EC",
        },
        amber: {
          DEFAULT: "#C08A2E",
          light: "#FBF1DF",
        },
        brick: {
          DEFAULT: "#A8412B",
          light: "#F8E9E5",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(22,33,31,0.04)",
      },
    },
  },
  plugins: [],
};
