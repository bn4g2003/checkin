const colors = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        primary: '#53CAFD',
        background: '#311898',
        surface: '#3D2C8D',
        'text-main': '#FFFFFF',
        'text-muted': '#B0A8D9',
        'surface-bright': '#4835A0',
        'border-highlight': '#5E4BB8',
        // Keep existing red for danger actions if needed, or override
        danger: colors.red,
      }
    },
  },
  plugins: [],
}