import type { Config } from 'tailwindcss'

// Tokens du design system Youcus (identite YouTube x Udemy, cf. docs/design).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#A435F0',
          'purple-dark': '#8710D8',
        },
        accent: {
          red: '#FF0033',
        },
        success: '#16A34A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
} satisfies Config
