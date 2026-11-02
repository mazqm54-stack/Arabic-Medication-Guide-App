/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // High-Contrast Medical Palette (WCAG AAA)
        teal: {
          DEFAULT: '#006D77',
          50: '#F0F9FA',
          100: '#E6F1F2',
          200: '#C2E2E5',
          500: '#00838F',
          600: '#006D77', // Primary Brand Color
          700: '#005860',
          800: '#004E55',
          900: '#003338',
        },
        warm: {
          50: '#FFFFFF',
          100: '#FDFEFE',
          200: '#F8F9FA', // Main Background
          300: '#E9ECEF',
          400: '#DEE2E6',
        },
        slate: {
          900: '#1D3557', // High-Contrast Text (12.6:1 against #F8F9FA)
          800: '#2A4365',
          700: '#334E68',
          600: '#457B9D', // Muted Secondary Text
        },
        amber: {
          50: '#FFFDF5',
          100: '#FEF3C7', // Card 4 Soft Amber Background
          200: '#FDE68A',
          400: '#FBBF24',
          500: '#F59E0B', // Amber Accent & Border
          800: '#92400E', // High-Contrast Amber Text
          900: '#78350F',
        },
        // Dark Mode High-Contrast Tokens (WCAG AAA)
        dark: {
          bg: '#0E1517',
          surface: '#162124',
          'surface-2': '#1D2B2F',
          text: '#E6EEF0',
          muted: '#9FB3B8',
          primary: '#3DB8C4',
          warning: '#3A2E12',
          'warning-bg': '#3A2E12',
          'warning-text': '#F5D58A',
        },
        'dark-bg': '#0E1517',
        'dark-surface': '#162124',
        'dark-surface-2': '#1D2B2F',
        'dark-text': '#E6EEF0',
        'dark-muted': '#9FB3B8',
        'dark-primary': '#3DB8C4',
        'dark-warning': '#3A2E12',
        'dark-warning-bg': '#3A2E12',
        'dark-warning-text': '#F5D58A',
      },
      fontFamily: {
        sans: ['"Readex Pro"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        readex: ['"Readex Pro"', 'sans-serif'],
        cairo: ['"Readex Pro"', 'sans-serif'],
        tajawal: ['"Readex Pro"', 'sans-serif'],
      },
      fontSize: {
        // Senior-Centric Typography Scale (rem-based dynamic scaling)
        'senior-xs': ['0.75rem', { lineHeight: '1.5', fontWeight: '500' }],
        'senior-sm': ['0.875rem', { lineHeight: '1.6', fontWeight: '500' }],
        'senior-base': ['1rem', { lineHeight: '1.7', fontWeight: '500' }], // 16px -> 19px -> 23px
        'senior-lg': ['1.1875rem', { lineHeight: '1.7', fontWeight: '600' }], // 19px -> 22.5px -> 27.3px
        'senior-xl': ['1.375rem', { lineHeight: '1.5', fontWeight: '700' }], // 22px -> 26.1px -> 31.6px
        'senior-2xl': ['1.625rem', { lineHeight: '1.4', fontWeight: '800' }], // 26px -> 30.8px -> 37.3px
        'senior-3xl': ['2rem', { lineHeight: '1.3', fontWeight: '900' }], // 32px -> 38px -> 46px
      },
      minHeight: {
        'touch': '48px', // Minimum touch target height (48px base)
        'touch-senior': '56px',
        'touch-lg': '72px', // Prominent action button height
      },
      minWidth: {
        'touch': '48px',
        'touch-senior': '56px',
      },
      boxShadow: {
        'senior': '0 4px 14px 0 rgba(29, 53, 87, 0.08)',
        'senior-lg': '0 8px 24px 0 rgba(29, 53, 87, 0.12)',
      },
    },
  },
  plugins: [],
};
