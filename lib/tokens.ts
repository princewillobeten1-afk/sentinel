/**
 * Sentinel Centralized Design Token System
 * Governs visual styling, colors, typography, spacing, border radii, shadows, and motion transitions.
 */

export const tokens = {
  colors: {
    // Core Dark Backgrounds
    background: {
      base: '#07090D',       // Deepest app canvas background
      surface: '#0A0D13',    // Standard component background
      elevated: '#0a1122',   // Cards & Panels
      hover: '#101a30',      // Hover state
      active: '#15223e',     // Active state
    },

    // Borders
    border: {
      subtle: '#14203a',
      default: '#1F2733',
      focus: '#3B8FF0',
      strong: '#2B3542',
    },

    // Typography Text Colors
    text: {
      primary: '#F2F5F9',    // High-contrast headings and primary content
      secondary: '#C6CEDA',  // Subtitles and table text
      muted: '#6E7A8A',      // Captions and disabled labels
      inverse: '#07090D',    // Text on bright accents
    },

    // Trading Financial & Status Indicators
    trading: {
      buy: '#12B574',        // Emerald Green (Gains, Buys)
      buyHover: '#0E9760',
      buyBg: 'rgba(16, 185, 129, 0.12)',
      buyBorder: 'rgba(16, 185, 129, 0.3)',

      sell: '#EC5A5F',       // Rose Red (Losses, Sells)
      sellHover: '#D93E44',
      sellBg: 'rgba(244, 63, 94, 0.12)',
      sellBorder: 'rgba(244, 63, 94, 0.3)',

      warning: '#E5A23D',    // Amber (Risk Alerts, Threats)
      warningBg: 'rgba(245, 158, 11, 0.12)',
      warningBorder: 'rgba(245, 158, 11, 0.3)',

      info: '#3B8FF0',       // Intelligence Cyan
      infoBg: 'rgba(56, 189, 248, 0.12)',
      infoBorder: 'rgba(56, 189, 248, 0.3)',

      neutral: '#2B3542',
    },

    // Accents
    accent: {
      cyan: '#2B6FC4',
      blue: '#3B8FF0',
      purple: '#A78BFA',
    },
  },

  // Standardized 4px-Based Spacing Scale
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },

  // Border Radii Tokens
  radius: {
    sm: '4px',       // Badges, small tags, tooltips
    md: '8px',       // Buttons, inputs, table cells
    lg: '12px',      // Cards, panels, drawers
    full: '9999px',  // Pill badges, circular buttons
  },

  // Elevation Shadows
  shadows: {
    card: '0 4px 20px -2px rgba(0, 0, 0, 0.4)',
    glow: '0 0 15px -3px rgba(56, 189, 248, 0.2)',
    glowBuy: '0 0 15px -3px rgba(16, 185, 129, 0.3)',
    glowSell: '0 0 15px -3px rgba(244, 63, 94, 0.3)',
  },

  // Motion Transitions
  motion: {
    fast: '100ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Typography Settings
  typography: {
    fontSans: 'Inter, system-ui, sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
};
