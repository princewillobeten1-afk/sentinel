import type { Config } from 'tailwindcss';

/**
 * Sentinel design tokens.
 *
 * Deep obsidian-slate grounds (L0 #06070B -> L4 #222634), electric cobalt-indigo
 * interactive accent (#526FFF), and crisp semantic buy/sell hues (#2FE3AC / #EC397A).
 */

const neutral = {
  50: '#FFFFFF',  // pure white highlights
  100: '#F7F8F9', // crisp primary text
  200: '#E4E5EB', // high-contrast secondary text
  300: '#C8C9D1', // secondary values
  400: '#828598', // muted labels / secondary metadata
  500: '#525866', // faint/disabled labels
  600: '#32374A', // emphasized borders & hover outlines
  700: '#222634', // active control surface & crisp hairline borders
  750: '#1C202B', // interactive inputs, hover rows, preset pills (L3)
  800: '#151821', // elevated cards, swap module shell, modal surface (L2)
  850: '#11141B', // sub-panel & sticky column headers (L1.5)
  900: '#0D1015', // structural panels, navbars, column shells, sidebar (L1)
  950: '#06070B', // deep obsidian root canvas (L0)
};

// Axiom Electric Cobalt-Indigo accent — primary interactive & emphasis hue.
const accent = {
  50: '#EEF1FF',
  100: '#DCE3FF',
  200: '#B8C6FF',
  300: '#8EA2FF',
  400: '#6683FF',
  500: '#526FFF', // primary electric cobalt
  600: '#3E58E8',
  700: '#2E43C2',
  800: '#243496',
  900: '#1A256E',
  950: '#0E1442',
};

// Buy / profit / safe emerald.
const buy = {
  50: '#E9FDF7',
  100: '#C5FAEA',
  200: '#98F5DA',
  300: '#6FF3C8',
  400: '#2FE3AC', // luminous emerald delta / CTA
  500: '#12AF80', // deep emerald fresh age / safe pill
  600: '#0E916A',
  700: '#0B7253',
  800: '#08563F',
  900: '#063F2E',
  950: '#04261C',
};

// Sell / risk / negative rose.
const sell = {
  50: '#FFF0F4',
  100: '#FFE0E8',
  200: '#FFBACB',
  300: '#FF8A8E',
  400: '#FF6166', // alert crimson risk text
  500: '#EC397A', // vibrant rose sell CTA / delta
  600: '#D12665',
  700: '#AC1D52',
  800: '#881741',
  900: '#681232',
  950: '#2D0716',
};

// High-Vibrancy Warning / Bonding / Fee Amber
const warn = {
  50: '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  300: '#FFD67A',
  400: '#FFC453',
  500: '#FFB224', // radiant amber
  600: '#E59609',
  700: '#B87505',
  800: '#8F5904',
  900: '#6B4203',
  950: '#291A02',
};

// AI / Smart Wallet / Whale Purple
const violet = {
  50: '#FAF5FF',
  100: '#F3E8FF',
  200: '#E9D5FF',
  300: '#D8B4FE',
  400: '#AC68FF',
  500: '#984DF5',
  600: '#7E35DB',
  700: '#6526B8',
  800: '#501F91',
  900: '#3B166E',
  950: '#240B47',
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
        primary: { DEFAULT: accent[500], foreground: neutral[50] },
        secondary: { DEFAULT: neutral[800], foreground: neutral[200] },
        destructive: { DEFAULT: sell[500], foreground: neutral[100] },
        border: '#1E222D',
        input: '#1E222D',
        ring: accent[500],
        phivex: { ...neutral, 500: accent[500], 400: accent[400], 300: accent[300], 700: '#1E222D', 600: '#2A3040' },
        sentinel: { ...neutral, 500: accent[500], 400: accent[400], 300: accent[300], 700: '#1E222D', 600: '#2A3040' },
        surface: {
          DEFAULT: neutral[800],
          muted: neutral[850],
          subtle: neutral[750],
          border: '#1E222D',
        },
        accent,
        buy,
        sell,
        warn,
        trading: {
          buy: buy[400],
          'buy-hover': buy[500],
          'buy-bg': 'rgba(47, 227, 172, 0.12)',
          'buy-border': 'rgba(47, 227, 172, 0.35)',
          sell: sell[500],
          'sell-hover': sell[600],
          'sell-bg': 'rgba(236, 57, 122, 0.12)',
          'sell-border': 'rgba(236, 57, 122, 0.35)',
          warning: warn[500],
          'warning-bg': 'rgba(255, 178, 36, 0.12)',
          'warning-border': 'rgba(255, 178, 36, 0.35)',
          info: '#52C5FF',
          'info-bg': 'rgba(82, 111, 255, 0.14)',
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
        'gradient-glow': 'linear-gradient(to right, rgba(82,111,255,0.12), rgba(47,227,172,0.10))',
        'gradient-header': 'linear-gradient(180deg, rgba(13,16,21,0.98) 0%, rgba(6,7,11,0.98) 100%)',
      },

      boxShadow: {
        card: '0 2px 8px 0 rgba(0,0,0,0.45), 0 8px 24px -4px rgba(0,0,0,0.65)',
        'card-lift': '0 4px 12px 0 rgba(0,0,0,0.5), 0 16px 36px -6px rgba(0,0,0,0.7)',
        'card-highlight': 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 4px 16px -4px rgba(0,0,0,0.55)',
        glass: 'inset 0 1px 0 0 rgba(255,255,255,0.08)',
        'glass-lift': 'inset 0 1px 0 0 rgba(255,255,255,0.12), 0 8px 24px -4px rgba(0,0,0,0.5)',
        glow: '0 0 0 1px rgba(82,111,255,0.45)',
        'glow-strong': '0 0 0 1px rgba(82,111,255,0.7), 0 2px 12px -2px rgba(82,111,255,0.35)',
        'glow-cobalt': '0 0 14px rgba(82, 111, 255, 0.35)',
        'glow-emerald': '0 0 12px rgba(47, 227, 172, 0.25)',
        'glow-buy': '0 0 0 1px rgba(47,227,172,0.45)',
        'glow-sell': '0 0 0 1px rgba(236,57,122,0.45)',
        'glow-amber': '0 0 0 1px rgba(255,178,36,0.45)',
      },

      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        inter: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-space-grotesk)', 'var(--font-inter)', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'sans-serif'],
        space: ['var(--font-space-grotesk)', 'sans-serif'],
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
