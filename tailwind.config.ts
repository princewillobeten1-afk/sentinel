import type { Config } from 'tailwindcss';

/**
 * Sentinel design tokens.
 *
 * Cool graphite grounds, one azure accent, and semantic buy/sell hues tuned for
 * long sessions on a dark screen. These values are the same ones already hard-set
 * in `app/globals.css` (page ground `#07090D`, focus ring `#3B8FF0`, scrollbars
 * `#1F2733`/`#2B3542`, `.label-micro` `#98A3B3`, `.delta-up/down`
 * `#12B574`/`#EC5A5F`) — the two files must agree, or components styled through
 * Tailwind classes drift away from the ones styled by the stylesheet.
 *
 * Two deliberate departures from the neon set this replaces:
 *
 *  - **The accent is not cyan.** Neon cyan (`#00F0FF`) and neon mint (`#00E599`)
 *    sit ~30° apart on a dark ground and both read as "highlighted", so an
 *    accent link and a rising price competed for the same meaning. Azure is far
 *    enough from the buy green that colour alone tells you which is which.
 *  - **Rungs 300/400 carry the hue, not just 500.** The rendered UI overwhelmingly
 *    uses `-300` and `-400` for text on dark surfaces; a palette change that only
 *    moved `-500` would be invisible on screen.
 */

// Cool graphite.
//
// The dark end of this ramp is spaced deliberately wide. It previously ran
// #07090D → #0A0E14 → #0D1219 → #12171F — four "levels" separated by 3–5 RGB
// points, which no monitor resolves, so ground, panel, card and sub-panel all
// rendered as one flat black and the UI read as muddy rather than deep. Worse,
// border-700 (#1F2733) was measured on screen as the *same* value as the card
// it bounded, making borders invisible.
//
// Each step below is now 7–17 points, so surfaces stack visibly and a border
// reads against the surface it sits on. Depth comes from these steps, not from
// glows — which is what the neon theme was compensating for.
const neutral = {
  50: '#F7F9FB',
  100: '#F2F5F9', // primary text — matches ::selection in globals.css
  200: '#DDE3EB',
  300: '#C6CEDA', // secondary text — matches :root color in globals.css
  400: '#98A3B3', // muted text — matches .label-micro
  500: '#6E7A8A', // faint decorative text — matches .delta-flat
  600: '#445366', // elevated border / divider on a raised surface
  700: '#33404F', // standard border — must read against 800, see note below
  750: '#26303E', // hover surface
  800: '#1C2531', // card surface
  850: '#151C26', // sub-panel surface
  900: '#0E131B', // app container ground
  950: '#07090D', // deep page ground — matches html/body in globals.css
};

// Azure accent — the one hue used for interactive/emphasis.
const accent = {
  50: '#EBF3FE',
  100: '#D6E7FD',
  200: '#ADCFFB',
  300: '#7FB2F6',
  400: '#5A9FF3',
  500: '#3B8FF0', // azure — the single accent
  600: '#2E72C4',
  700: '#245A9B',
  800: '#1B4373',
  900: '#132F51',
  950: '#0C1E34',
};

// Buy / profit.
const buy = {
  50: '#E7F9F1',
  100: '#C6F2E0',
  200: '#92E5C4',
  300: '#5AD3A4',
  400: '#2CC189',
  500: '#12B574', // buy / profit
  600: '#0E9660',
  700: '#0B764C',
  800: '#08573A',
  900: '#063E29',
  950: '#04281B',
};

// Sell / risk.
const sell = {
  50: '#FDEDEE',
  100: '#FBD9DB',
  200: '#F7B4B7',
  300: '#F28D92',
  400: '#EF7176',
  500: '#EC5A5F', // sell / risk
  600: '#D93F45',
  700: '#B62F35',
  800: '#8C2429',
  900: '#661B1F',
  950: '#3D1013',
};

// High-Vibrancy Warning / Fee Amber
const warn = {
  50: '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  300: '#FCD34D',
  400: '#FBBF24',
  500: '#FFB800', // radiant gold
  600: '#F59E0B',
  700: '#D97706',
  800: '#B45309',
  900: '#78350F',
  950: '#451A03',
};

// AI / Intelligence Purple
const violet = {
  50: '#FAF5FF',
  100: '#F3E8FF',
  200: '#E9D5FF',
  300: '#D8B4FE',
  400: '#C084FC',
  500: '#A855F7',
  600: '#9333EA',
  700: '#7E22CE',
  800: '#6B21A8',
  900: '#581C87',
  950: '#3B0764',
};

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}', './lib/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        background: neutral[950],
        foreground: neutral[200],
        card: { DEFAULT: neutral[900], foreground: neutral[100] },
        popover: { DEFAULT: neutral[900], foreground: neutral[200] },
        muted: { DEFAULT: neutral[850], foreground: neutral[400] },
        primary: { DEFAULT: accent[400], foreground: neutral[950] },
        secondary: { DEFAULT: neutral[800], foreground: neutral[200] },
        destructive: { DEFAULT: sell[600], foreground: neutral[100] },
        border: neutral[700],
        input: neutral[700],
        ring: accent[400],
        sentinel: { ...neutral, 500: accent[500], 400: accent[300], 300: accent[200] },
        surface: {
          DEFAULT: neutral[800],
          muted: neutral[850],
          subtle: neutral[750],
          border: neutral[700],
        },
        accent,
        trading: {
          buy: buy[600],
          'buy-hover': buy[500],
          'buy-bg': 'rgba(18, 181, 116, 0.12)',
          'buy-border': 'rgba(18, 181, 116, 0.35)',
          sell: sell[600],
          'sell-hover': sell[500],
          'sell-bg': 'rgba(236, 90, 95, 0.12)',
          'sell-border': 'rgba(236, 90, 95, 0.35)',
          warning: warn[500],
          'warning-bg': 'rgba(255, 184, 0, 0.12)',
          'warning-border': 'rgba(255, 184, 0, 0.35)',
          info: accent[400],
          'info-bg': 'rgba(59, 143, 240, 0.10)',
        },

        slate: neutral,
        gray: neutral,
        zinc: neutral,
        neutral,
        sky: accent,
        blue: accent,
        cyan: accent,
        indigo: accent,
        purple: violet,
        violet,
        emerald: buy,
        green: buy,
        teal: buy,
        rose: sell,
        red: sell,
        pink: sell,
        amber: warn,
        yellow: warn,
        orange: warn,
      },

      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }], // 11px
        xs:    ['0.75rem',   { lineHeight: '1.125rem' }],                      // 12px
        sm:    ['0.8125rem', { lineHeight: '1.25rem' }],                       // 13px
        base:  ['0.875rem',  { lineHeight: '1.375rem' }],                      // 14px
        lg:    ['1rem',      { lineHeight: '1.5rem' }],                        // 16px
        xl:    ['1.125rem',  { lineHeight: '1.625rem', letterSpacing: '-0.01em' }],
        '2xl': ['1.375rem',  { lineHeight: '1.875rem', letterSpacing: '-0.015em' }],
        '3xl': ['1.75rem',   { lineHeight: '2.125rem', letterSpacing: '-0.02em' }],
        '4xl': ['2.25rem',   { lineHeight: '2.5rem',   letterSpacing: '-0.025em' }],
        '5xl': ['3rem',      { lineHeight: '3.25rem',  letterSpacing: '-0.03em' }],
      },

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-glass': 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
        'gradient-glow': 'linear-gradient(to right, rgba(59,143,240,0.10), rgba(18,181,116,0.10))',
        'gradient-header': 'linear-gradient(180deg, rgba(18,23,31,0.95) 0%, rgba(13,18,25,0.95) 100%)',
      },

      boxShadow: {
        card: '0 2px 8px 0 rgba(0,0,0,0.45), 0 8px 24px -4px rgba(0,0,0,0.65)',
        'card-lift': '0 4px 12px 0 rgba(0,0,0,0.5), 0 16px 36px -6px rgba(0,0,0,0.7)',
        glass: 'inset 0 1px 0 0 rgba(255,255,255,0.08)',
        'glass-lift': 'inset 0 1px 0 0 rgba(255,255,255,0.12), 0 8px 24px -4px rgba(0,0,0,0.5)',
        // Rings, not halos. The previous values painted a 16px coloured bloom
        // around any element using them, which on a dark ground bleeds into
        // neighbouring rows in a dense table.
        glow: '0 0 0 1px rgba(59,143,240,0.45)',
        'glow-strong': '0 0 0 1px rgba(59,143,240,0.7), 0 2px 10px -2px rgba(0,0,0,0.6)',
        'glow-buy': '0 0 0 1px rgba(18,181,116,0.5)',
        'glow-sell': '0 0 0 1px rgba(236,90,95,0.5)',
        'glow-amber': '0 0 0 1px rgba(255,184,0,0.5)',
      },

      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        inter: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },

      keyframes: {
        'pulse-slow': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.65' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-3px)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'pulse-slow': 'pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 4s ease-in-out infinite',
        shimmer: 'shimmer 2s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
