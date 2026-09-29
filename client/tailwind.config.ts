import type { Config } from 'tailwindcss'

// Tokens du design system Youcus (identite YouTube x Udemy, cf. docs/design).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Couleurs de marque pilotées par variables CSS : elles changent en mode sombre (cf. Figma).
        brand: {
          purple: 'rgb(var(--yc-purple) / <alpha-value>)',
          'purple-dark': 'rgb(var(--yc-purple-hover) / <alpha-value>)',
        },
        'on-purple': 'rgb(var(--yc-on-purple) / <alpha-value>)',
        accent: {
          red: 'rgb(var(--yc-red) / <alpha-value>)',
        },
        success: 'rgb(var(--yc-success) / <alpha-value>)',
        // Tokens semantiques pilotes par variables CSS (light/dark), cf. styles/index.css.
        canvas: 'var(--yc-canvas)',
        surface: {
          DEFAULT: 'var(--yc-surface)',
          2: 'var(--yc-surface-2)',
        },
        line: 'var(--yc-line)',
        content: {
          DEFAULT: 'var(--yc-content)',
          muted: 'var(--yc-content-muted)',
        },
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
