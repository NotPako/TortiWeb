import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        tortilla: {
          50: '#fff8e6',
          100: '#ffeec2',
          200: '#ffdb85',
          300: '#ffc347',
          400: '#ffae1f',
          500: '#f59300',
          600: '#cc7300',
          700: '#a25400',
          800: '#7a3e00',
          900: '#5a2d00',
        },
      },
      fontFamily: {
        display: ['system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
