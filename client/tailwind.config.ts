import type { Config } from 'tailwindcss'

// Youcus design system (Figma « Youcus · Design System »): paper, ink, one red signal.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Design system tokens (YC-66), light and dark through CSS variables (styles/tokens.css).
        page: 'var(--yc-bg-page)',
        app: 'var(--yc-bg-app)',
        sunken: 'var(--yc-bg-sunken)',
        inverse: 'var(--yc-bg-inverse)',
        stage: 'var(--yc-bg-stage)',
        mark: 'var(--yc-bg-mark)',
        'on-mark': 'var(--yc-text-on-mark)',
        accent: {
          DEFAULT: 'rgb(var(--yc-accent-rgb) / <alpha-value>)',
          hover: 'rgb(var(--yc-accent-hover-rgb) / <alpha-value>)',
          text: 'var(--yc-text-accent)',
          // First theme's name, now the red signal.
          red: 'rgb(var(--yc-accent-rgb) / <alpha-value>)',
        },
        'on-accent': 'rgb(var(--yc-on-accent-rgb) / <alpha-value>)',
        error: { DEFAULT: 'var(--yc-text-error)', bg: 'var(--yc-bg-error)' },
        success: 'rgb(var(--yc-success-rgb) / <alpha-value>)',
        'success-bg': 'var(--yc-bg-success)',
        status: {
          'success-bg': 'var(--yc-status-success-bg)',
          'success-text': 'var(--yc-status-success-text)',
          'warning-bg': 'var(--yc-status-warning-bg)',
          'warning-text': 'var(--yc-status-warning-text)',
          'error-bg': 'var(--yc-status-error-bg)',
          'error-text': 'var(--yc-status-error-text)',
        },
        'line-strong': 'var(--yc-border-strong)',
        focus: 'var(--yc-border-focus)',
        // First theme's names, pointing at the design system (each page ticket moves to the names above).
        brand: {
          purple: 'rgb(var(--yc-accent-rgb) / <alpha-value>)',
          'purple-dark': 'rgb(var(--yc-accent-hover-rgb) / <alpha-value>)',
        },
        'on-purple': 'rgb(var(--yc-on-accent-rgb) / <alpha-value>)',
        canvas: 'var(--yc-bg-page)',
        surface: {
          DEFAULT: 'var(--yc-bg-surface)',
          2: 'var(--yc-bg-sunken)',
        },
        line: 'var(--yc-border-default)',
        content: {
          DEFAULT: 'var(--yc-text-primary)',
          muted: 'var(--yc-text-muted)',
          inverse: 'var(--yc-text-inverse)',
        },
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // Figma text styles: [size, { lineHeight, letterSpacing }].
      fontSize: {
        display: ['104px', { lineHeight: '96px', letterSpacing: '-0.03em' }],
        'title-56': ['56px', { lineHeight: '58px', letterSpacing: '-0.01em' }],
        'title-34': ['34px', { lineHeight: '38px' }],
        'title-24': ['24px', { lineHeight: '28px' }],
        lead: ['20px', { lineHeight: '32px' }],
        'body-16': ['16px', { lineHeight: '26px' }],
        'body-15': ['15px', { lineHeight: '24px' }],
        'label-14': ['14px', { lineHeight: '20px' }],
        'small-13': ['13px', { lineHeight: '18px' }],
        'mono-12': ['12px', { lineHeight: '16px', letterSpacing: '0.04em' }],
      },
      borderRadius: {
        card: '12px',
        // Prefixed: Tailwind's own rounded-lg and the others keep their size until a page moves.
        'yc-sm': 'var(--yc-radius-sm)',
        'yc-md': 'var(--yc-radius-md)',
        'yc-lg': 'var(--yc-radius-lg)',
        'yc-xl': 'var(--yc-radius-xl)',
      },
      // A bare `border` takes the design's line, not Tailwind's grey.
      borderColor: { DEFAULT: 'var(--yc-border-default)' },
      boxShadow: {
        modal: 'var(--yc-shadow-modal)',
        toast: 'var(--yc-shadow-toast)',
      },
      // Figma « Squelette » 96:140: opacity 1 → 0.55, 1.2 s (none under prefers-reduced-motion, in the component).
      // Figma « Toast » 5:258: the bar at the bottom shows the 5 s delay.
      keyframes: {
        'yc-pulse': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
        'yc-toast-delay': { from: { transform: 'scaleX(1)' }, to: { transform: 'scaleX(0)' } },
      },
      animation: {
        'yc-pulse': 'yc-pulse 1.2s ease-in-out infinite',
        'yc-toast-delay': 'yc-toast-delay 5s linear forwards',
      },
      minHeight: { touch: 'var(--yc-size-touch-min)' },
      minWidth: { touch: 'var(--yc-size-touch-min)' },
    },
  },
  plugins: [],
} satisfies Config
