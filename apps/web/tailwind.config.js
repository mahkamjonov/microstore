/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#006948",
        "primary-container": "#00855d",
        "on-primary": "#ffffff",
        "on-primary-container": "#f5fff7",
        secondary: "#0058be",
        "secondary-container": "#2170e4",
        "on-secondary": "#ffffff",
        tertiary: "#006947",
        "tertiary-container": "#00855b",
        surface: "#f7f9fb",
        "surface-container": "#eceef0",
        "surface-container-low": "#f2f4f6",
        "surface-container-high": "#e6e8ea",
        "surface-container-lowest": "#ffffff",
        "on-surface": "#191c1e",
        "on-surface-variant": "#3d4a42",
        outline: "#6d7a72",
        "outline-variant": "#bccac0",
        background: "#f7f9fb",
        "on-background": "#191c1e",
        error: "#ba1a1a",
        "error-container": "#ffdad6",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        headline: ["Plus Jakarta Sans", "sans-serif"],
        currency: ["Plus Jakarta Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
}
