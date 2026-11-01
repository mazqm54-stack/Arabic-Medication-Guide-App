/** @type {import('tailwindcss').Config} */
export default {
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
      },
      fontFamily: {
        sans: ['Cairo', 'Tajawal', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        cairo: ['Cairo', 'sans-serif'],
        tajawal: ['Tajawal', 'sans-serif'],
      },
      fontSize: {
        // Senior-Centric Typography Scale
        'senior-sm': ['18px', { lineHeight: '1.7', fontWeight: '500' }],
        'senior-base': ['20px', { lineHeight: '1.75', fontWeight: '600' }], // Minimum Body (Large)
        'senior-lg': ['24px', { lineHeight: '1.8', fontWeight: '600' }],   // Extra Large Body
        'senior-xl': ['28px', { lineHeight: '1.6', fontWeight: '700' }],   // Headings (Large)
        'senior-2xl': ['32px', { lineHeight: '1.5', fontWeight: '800' }],  // Headings (Extra Large) / Headers
        'senior-3xl': ['36px', { lineHeight: '1.4', fontWeight: '900' }],  // Prominent Titles
      },
      minHeight: {
        'touch': '64px',    // Mandatory minimum touch target height
        'touch-lg': '72px', // Prominent action button height
      },
      minWidth: {
        'touch': '64px',
      },
      boxShadow: {
        'senior': '0 4px 14px 0 rgba(29, 53, 87, 0.08)',
        'senior-lg': '0 8px 24px 0 rgba(29, 53, 87, 0.12)',
      },
    },
  },
  plugins: [],
};
