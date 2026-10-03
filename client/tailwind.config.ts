import type { Config } from 'tailwindcss'

// Youcus design system (Figma « Youcus · Design System »): paper, ink, one red signal.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      spacing: {
        // The side margin of the public pages (YC-90): 80 px, then whatever keeps the content in a
        // centred 1440 px column on a wider screen (80 + 1280 + 80), backgrounds staying full width.
        gutter: 'max(5rem, calc((100% - 80rem) / 2))',
      },
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
        // Figma « Tiroir de navigation » 108:325: it slides from the left over a veil.
        'yc-drawer-in': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'yc-fade': { from: { opacity: '0' }, to: { opacity: '1' } },
        // Figma « Mouvement » 3:101: an entrance slides 24 px OR scales 0.96 → 1, with a fade; one axis.
        'yc-rise': { from: { opacity: '0', transform: 'translateY(24px)' }, to: { opacity: '1', transform: 'none' } },
        'yc-pop': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'none' } },
        // « Le playhead suit la vidéo, jamais d'easing sur une mesure » : linear.
        'yc-playhead': { from: { width: '0%' }, to: { width: 'var(--yc-playhead-to)' } },
        'yc-marquee': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        // The public site moves as the canvas of 29/09 drew it (YC-91, decision of Ronaldo): longer
        // entrances than the app, a scene in the hero. The app keeps the 300 ms of « Mouvement ».
        'yc-enter': { from: { opacity: '0', transform: 'translateY(28px)' }, to: { opacity: '1', transform: 'none' } },
        'yc-note': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
        'yc-letter': { from: { opacity: '0', transform: 'translateY(110%) rotate(8deg)' }, to: { opacity: '1', transform: 'none' } },
        // A distraction of YouTube leaves the scene, each one its own way (--yc-dx, --yc-dy, --yc-r).
        'yc-shed': {
          from: { opacity: '1', transform: 'translate(0, 0) rotate(var(--yc-r))' },
          to: { opacity: '0', transform: 'translate(var(--yc-dx), var(--yc-dy)) rotate(var(--yc-r)) scale(0.85)' },
        },
        'yc-draw-x': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        'yc-draw-y': { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
        // The words under a mark keep the ink of the page until the mark is under them (dark theme: light ink).
        'yc-ink-on-mark': { from: { color: 'var(--yc-text-primary)' }, to: { color: 'var(--yc-text-on-mark)' } },
        'yc-rec': { '0%, 100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '0.35', transform: 'scale(0.8)' } },
        'yc-blink': { '0%, 49%': { opacity: '1' }, '50%, 100%': { opacity: '0' } },
        'yc-orbit': { to: { transform: 'rotate(360deg)' } },
        // A small thing that arrives with a bounce: a status, a point of the journal.
        'yc-bounce-in': {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '60%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // The badge of the creator floats, keeping its tilt.
        'yc-float': { from: { transform: 'translateY(0) rotate(-6deg)' }, to: { transform: 'translateY(-8px) rotate(-4deg)' } },
      },
      animation: {
        'yc-pulse': 'yc-pulse 1.2s ease-in-out infinite',
        'yc-toast-delay': 'yc-toast-delay 5s linear forwards',
        'yc-rise': 'yc-rise 300ms ease-out both',
        'yc-pop': 'yc-pop 300ms ease-out both',
        'yc-playhead': 'yc-playhead 6s linear both',
        'yc-marquee': 'yc-marquee 40s linear infinite',
        // `backwards`, not `both`: once in, the block gives its transform back, so a hover can lift it.
        'yc-enter': 'yc-enter 900ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards',
        'yc-note': 'yc-note 400ms ease-out backwards',
        'yc-letter': 'yc-letter 900ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards',
        'yc-shed': 'yc-shed 1s cubic-bezier(0.5, 0, 0.2, 1) both',
        'yc-draw-x': 'yc-draw-x 1s cubic-bezier(0.6, 0, 0.2, 1) backwards',
        'yc-draw-y': 'yc-draw-y 2.4s cubic-bezier(0.6, 0, 0.2, 1) backwards',
        'yc-ink-on-mark': 'yc-ink-on-mark 1s cubic-bezier(0.6, 0, 0.2, 1) backwards',
        'yc-rec': 'yc-rec 1.6s ease-in-out infinite',
        'yc-blink': 'yc-blink 1s steps(1) infinite',
        'yc-orbit': 'yc-orbit 40s linear infinite',
        'yc-bounce-in': 'yc-bounce-in 500ms ease-out backwards',
        'yc-float': 'yc-float 3s ease-in-out infinite alternate',
      },
      minHeight: { touch: 'var(--yc-size-touch-min)' },
      minWidth: { touch: 'var(--yc-size-touch-min)' },
    },
  },
  plugins: [],
} satisfies Config
