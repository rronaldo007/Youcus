import { Link } from 'react-router-dom'
import { BUTTON_BASE } from '@/components/ui/buttonStyles'
import { formatTimestamp } from '@/lib/format'
import { timeLeft } from '@/features/dashboard/dashboardText'
import type { ResumeItem } from '@/types'

/**
 * Figma « Tableau de bord » 11:5, « Reprendre »: the last video started and not finished. Both players
 * open at the saved position, so the button can name it. The tablet and the phone keep the place
 * in the course and the button, the thumbnail and the time left show on a computer only.
 */
export function ResumeBanner({ item }: { item: ResumeItem }) {
  const to = item.playlist ? `/playlists/${item.playlist.id}/watch/${item.youtubeId}` : `/videos/${item.youtubeId}`
  const place = item.playlist ? `vidéo ${item.playlist.position} sur ${item.playlist.total}` : 'vidéo seule'
  const left = timeLeft(item.durationSeconds, item.watchedSeconds)

  return (
    <section
      aria-label="Reprendre"
      className="flex w-full flex-col gap-4 rounded-yc-xl bg-inverse px-4 py-4 text-content-inverse md:px-6 md:py-5 xl:flex-row xl:items-center xl:gap-6"
    >
      <div className="relative hidden h-[72px] w-32 shrink-0 overflow-hidden rounded-yc-md border border-white/[0.12] bg-stage xl:block">
        {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="truncate font-mono text-mono-12">
          <span className="uppercase">Reprendre</span>
          {item.playlist && <span className="hidden xl:inline"> · {item.playlist.title}</span>} · {place}
        </p>
        <p className="truncate font-serif text-title-24 xl:text-title-34">{item.title}</p>
        <p className="hidden text-small-13 font-medium xl:block">
          {left} pour finir la vidéo
        </p>
      </div>
      <Link to={to} className={`${BUTTON_BASE} w-full bg-accent text-on-accent hover:bg-accent-hover focus-visible:outline-focus xl:w-auto`}>
        Reprendre à {formatTimestamp(item.watchedSeconds)}
      </Link>
    </section>
  )
}
