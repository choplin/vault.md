/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/web/**/*.{html,js,svelte,ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [require('@tailwindcss/typography'), require('daisyui')],
  daisyui: {
    themes: ['light'],
  },
}
