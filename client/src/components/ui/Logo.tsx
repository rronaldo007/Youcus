/** The sizes of the logo in the design: the app bar, the phone drawer, the public site. */
const SIZES = {
  app: { dot: 'size-[9px]', text: 'text-title-24', gap: 'gap-2' },
  drawer: { dot: 'size-[9px]', text: 'text-[26px] leading-8', gap: 'gap-2' },
  public: { dot: 'size-2.5', text: 'text-title-34', gap: 'gap-2.5' },
}

/** Logo Youcus (Figma « Barre de navigation » 5:433): a red signal dot and the name in Instrument Serif. */
export function Logo({ size = 'app' }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size]
  return (
    <span className={`inline-flex items-center ${s.gap}`}>
      {/* On the public site the dot records, as on the canvas of 29/09 (YC-91); the app stays still. */}
      <span aria-hidden="true" className={`${s.dot} shrink-0 rounded-full bg-accent ${size === 'public' ? 'motion-safe:animate-yc-rec' : ''}`} />
      <span className={`whitespace-nowrap font-serif text-content ${s.text}`}>Youcus</span>
    </span>
  )
}
