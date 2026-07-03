import type { Config } from 'tailwindcss';

/**
 * Tailwind konfiguráció — visszafogott, enterprise világos téma.
 * A `content` szkennelés csak a ténylegesen használt könyvtárakra korlátozódik,
 * így a legenerált CSS minimális (Core Web Vitals / kisebb bundle).
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f8fafc',
          muted: '#f1f5f9',
        },
      },
    },
  },
  plugins: [],
};

export default config;
