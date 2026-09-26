import type { Config } from 'tailwindcss';

const v = (name: string) => `var(--${name})`;
// Opacity modifiers (bg-bad/10) on CSS-variable colors via color-mix.
const c = (name: string) => `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px' },
    fontSize: {
      xs: ['12px', '16px'],
      sm: ['14px', '20px'],
      base: ['16px', '24px'],
      lg: ['20px', '28px'],
      xl: ['24px', '32px'],
      '2xl': ['32px', '38px'],
      '3xl': ['40px', '46px'],
    },
    extend: {
      colors: {
        bg: c('bg'),
        surface: c('surface'),
        'surface-2': c('surface-2'),
        text: c('text'),
        muted: c('text-muted'),
        border: c('border'),
        accent: c('accent'),
        'accent-contrast': c('accent-contrast'),
        good: c('good'),
        bad: c('bad'),
        neutral: c('neutral'),
      },
      borderRadius: { DEFAULT: v('radius'), card: v('radius') },
      maxWidth: { content: '1200px' },
      fontFamily: { sans: ['var(--font-inter)', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;
