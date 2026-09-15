/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Keeps your dark mode working
  theme: {
    extend: {},
  },
  plugins: [
    // 👇 This is the magic line that makes the summary look beautiful
    require('@tailwindcss/typography'),
  ],
}