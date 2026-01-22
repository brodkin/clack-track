import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/web/frontend/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Mobile-first breakpoints (Tailwind defaults):
      // sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
