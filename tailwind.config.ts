import type { Config } from 'tailwindcss';

/**
 * Sentinel Figma-Grade Design Tokens.
 *
 * Provides deep obsidian dark grounds, high-contrast typography, crisp glassmorphic
 * surfaces, vibrant semantic neon accents (cyan/emerald/rose/amber/purple), and
 * high-density financial terminal scales.
 */

// Obsidian neutrals with subtle cool-slate bias for rich depth and contrast.
const neutral = {
  50: '#F8FAFC',
  100: '#F1F5F9', // primary text
  200: '#E2E8F0',
  300: '#CBD5E1', // secondary text
  400: '#94A3B8', // muted text
  500: '#64748B', // faint decorative text
  600: '#334155', // elevated border / highlight
  700: '#1E293B', // standard border
  750: '#151D2C', // hover surface
  800: '#0F1623', // card surface
  850: '#0B111D', // sub-panel surface
  900: '#080D17', // app container ground
  950: '#05080F', // deep page ground
};

// Electric Cyan / Azure Accent
const accent = {
  50: '#E0F7FE',
  100: '#B8EBFD',
  200: '#7CD5FB',
  300: '#38BDF8',
  400: '#0EA5E9',
  500: '#00F0FF', // electric neon cyan
  600: '#0284C7',
  700: '#0369A1',
  800: '#075985',
  900: '#0C4A6E',
  950: '#082F49',
};

// High-Vibrancy Buy / Profit Green
const buy = {
  50: '#ECFDF5',
  100: '#D1FAE5',
  200: '#A7F3D0',
  300: '#6EE7B7',
  400: '#34D399',
  500: '#00E599', // bright neon mint
  600: '#10B981',
  700: '#059669',
  800: '#047857',
  900: '#064E3B',
  950: '#022C22',
};

// High-Vibrancy Sell / Risk Rose-Red
const sell = {
  50: '#FFF1F2',
  100: '#FFE4E6',
  200: '#FECDD3',
  300: '#FDA4AF',
  400: '#FB7185',
  500: '#FF3B69', // electric crimson
  600: '#F43F5E',
  700: '#E11D48',
  800: '#BE123C',
  900: '#881337',
  950: '#4C0519',
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
          'buy-bg': 'rgba(0, 229, 153, 0.12)',
          'buy-border': 'rgba(0, 229, 153, 0.35)',
          sell: sell[600],
          'sell-hover': sell[500],
          'sell-bg': 'rgba(255, 59, 105, 0.12)',
          'sell-border': 'rgba(255, 59, 105, 0.35)',
          warning: warn[500],
          'warning-bg': 'rgba(255, 184, 0, 0.12)',
          'warning-border': 'rgba(255, 184, 0, 0.35)',
          info: accent[400],
          'info-bg': 'rgba(0, 240, 255, 0.10)',
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
        'gradient-glow': 'linear-gradient(to right, rgba(0,240,255,0.12), rgba(0,229,153,0.12))',
        'gradient-header': 'linear-gradient(180deg, rgba(15,22,35,0.95) 0%, rgba(11,17,29,0.95) 100%)',
      },

      boxShadow: {
        card: '0 2px 8px 0 rgba(0,0,0,0.45), 0 8px 24px -4px rgba(0,0,0,0.65)',
        'card-lift': '0 4px 12px 0 rgba(0,0,0,0.5), 0 16px 36px -6px rgba(0,0,0,0.7)',
        glass: 'inset 0 1px 0 0 rgba(255,255,255,0.08)',
        'glass-lift': 'inset 0 1px 0 0 rgba(255,255,255,0.12), 0 8px 24px -4px rgba(0,0,0,0.5)',
        glow: '0 0 0 1px rgba(0,240,255,0.35), 0 0 16px -2px rgba(0,240,255,0.25)',
        'glow-strong': '0 0 0 1px rgba(0,240,255,0.55), 0 4px 24px -4px rgba(0,240,255,0.35)',
        'glow-buy': '0 0 0 1px rgba(0,229,153,0.45), 0 0 16px -2px rgba(0,229,153,0.3)',
        'glow-sell': '0 0 0 1px rgba(255,59,105,0.45), 0 0 16px -2px rgba(255,59,105,0.3)',
        'glow-amber': '0 0 0 1px rgba(255,184,0,0.45), 0 0 16px -2px rgba(255,184,0,0.3)',
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
