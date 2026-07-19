/** Logo Youcus : marque « Y » rouge + libellé. Le libellé est masquable (mobile compact). */
export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-[34px] items-center justify-center rounded-[9px] bg-accent-red">
        <span className="text-lg font-bold leading-none text-white">Y</span>
      </div>
      {withWordmark && <span className="text-xl font-bold tracking-tight text-content">Youcus</span>}
    </div>
  )
}
