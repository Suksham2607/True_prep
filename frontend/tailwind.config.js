/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // Soft-UI / neumorphism design system (shared across the whole app).
      // Same numeric values also live as CSS custom properties in
      // src/index.css (--soft-bg / --soft-shadow-dark / --soft-shadow-light)
      // so the CSS-Module pages (Login, Register, Dashboard) render with
      // an identical look even though they don't go through Tailwind.
      colors: {
        soft: {
          bg: "#e6ebf1",       // base background all soft-UI surfaces sit on
          surface: "#e9edf3",  // slightly lighter panel/card surface
          shadowDark: "#b9c2d0",
          shadowLight: "#ffffff",
          text: "#33415c",
          textMuted: "#7b8aa3",
        },
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
        },
      },
      borderRadius: {
        soft: "18px",
        "soft-lg": "26px",
        "soft-sm": "12px",
      },
      boxShadow: {
        // "Raised" convex surfaces - the default resting state for cards,
        // panels, and buttons.
        "soft-flat": "9px 9px 18px #b9c2d0, -9px -9px 18px #ffffff",
        "soft-flat-sm": "5px 5px 10px #b9c2d0, -5px -5px 10px #ffffff",
        "soft-flat-lg": "14px 14px 28px #b9c2d0, -14px -14px 28px #ffffff",
        // "Pressed" concave surfaces - inputs, toggles, active/selected
        // states, anything that should read as "pushed in."
        "soft-inset": "inset 5px 5px 10px #b9c2d0, inset -5px -5px 10px #ffffff",
        "soft-inset-sm": "inset 3px 3px 6px #b9c2d0, inset -3px -3px 6px #ffffff",
        // Subtle hover lift for raised elements.
        "soft-flat-hover": "6px 6px 14px #b9c2d0, -6px -6px 14px #ffffff",
      },
    },
  },
  plugins: [],
}
