/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/screens/**/*.{js,jsx,ts,tsx}',
    './src/components/**/*.{js,jsx,ts,tsx}',
    './src/app/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF6347',
        secondary: '#000000',
        tertiary: '#171717',
        quaternary: '#1a1a1a',
      },
    },
  },
  plugins: [],
};
