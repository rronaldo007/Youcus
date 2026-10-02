import { useLayoutEffect, useRef, useState } from 'react'
import { buttonClass } from '@/components/ui/buttonStyles'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { LinkifiedText } from '@/features/player/LinkifiedText'
import { unavailableSentence } from '@/lib/availability'
import { formatTotalDuration } from '@/lib/format'
import type { PlaylistDetail } from '@/types'

const PRIVACY: Record<NonNullable<PlaylistDetail['privacyStatus']>, string> = {
  PUBLIC: 'Publique',
  UNLISTED: 'Non répertoriée',
  PRIVATE: 'Privée',
}

const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * The channel's face, or a neutral disc: Google's image hosts sometimes refuse to serve it
 * (ERR_BLOCKED_BY_ORB seen on 02/10), and a broken image must never show.
 */
function ChannelAvatar({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) return <span aria-hidden="true" className="size-7 shrink-0 rounded-full bg-sunken" />
  return <img src={url} alt="" onError={() => setFailed(true)} className="size-7 shrink-0 rounded-full object-cover" />
}

function Fact({ children }: { children: string }) {
  return <li className="whitespace-nowrap rounded-full bg-sunken px-2.5 py-[5px] font-mono text-mono-12 text-content">{children}</li>
}

/** The description folded to three lines, « Afficher toute la description » only when it hides something. */
function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || expanded) return
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(el)
    return () => observer?.disconnect()
  }, [text, expanded])

  return (
    <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
      <p ref={ref} className={`whitespace-pre-line break-words text-body-15 text-content ${expanded ? '' : 'line-clamp-3'}`}>
        <LinkifiedText text={text} />
      </p>
      {(overflows || expanded) && (
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)} className="text-label-14 font-semibold text-accent-text hover:underline">
          {expanded ? 'Afficher moins' : 'Afficher toute la description'}
        </button>
      )}
    </div>
  )
}

/**
 * Figma « Fiche YouTube » 24:68, playlist: « uniquement ce que l'API Data v3 fournit ; durée totale =
 * somme des durées des vidéos ; dernier ajout = date du dernier playlistItem ». The creation date,
 * the language and the topics of the frame are not stored (YC-85, decision of 02/10).
 */
export function PlaylistAbout({ playlist }: { playlist: PlaylistDetail }) {
  const unavailable = unavailableSentence(playlist.unavailable)
  const totalSeconds = playlist.videos.reduce((sum, v) => sum + (v.durationSeconds || 0), 0)
  const channel = playlist.multipleChannels ? null : playlist.contentChannel
  const count = playlist.videoCount

  return (
    <section aria-labelledby="a-propos-playlist" className="flex w-full flex-col gap-4 rounded-yc-xl border border-line bg-surface p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 id="a-propos-playlist" className="font-serif text-title-24 text-content">
          À propos de la playlist
        </h2>
        {playlist.youtubeUrl && (
          <a href={playlist.youtubeUrl} target="_blank" rel="noreferrer" className={buttonClass('ghost', 'px-3')}>
            Voir sur YouTube
          </a>
        )}
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:gap-8">
        <div className="flex flex-col gap-4 md:w-[320px] md:shrink-0">
          {(channel || playlist.multipleChannels) && (
            <p className="flex items-center gap-2.5 text-label-14 font-semibold text-content">
              {/* Several channels have no face to show: the name says it alone. */}
              {channel && <ChannelAvatar key={channel.avatarUrl} url={channel.avatarUrl} />}
              {channel?.title ?? 'Plusieurs chaînes'}
            </p>
          )}
          {unavailable && (
            <div role="status">
              <InlineMessage tone="error">{unavailable}</InlineMessage>
            </div>
          )}
          <ul aria-label="En chiffres" className="flex flex-wrap gap-1.5">
            <Fact>{`${count} vidéo${count > 1 ? 's' : ''}`}</Fact>
            {totalSeconds > 0 && <Fact>{`${formatTotalDuration(totalSeconds)} au total`}</Fact>}
            {playlist.lastAddedAt && <Fact>{`Dernier ajout le ${day(playlist.lastAddedAt)}`}</Fact>}
            {playlist.privacyStatus && <Fact>{PRIVACY[playlist.privacyStatus]}</Fact>}
          </ul>
        </div>
        {playlist.description?.trim() && <Description text={playlist.description} />}
      </div>
      {totalSeconds > 0 && (
        <>
          <div aria-hidden="true" className="h-px w-full bg-line" />
          <p className="text-small-13 font-medium text-content-muted">Durée totale calculée à partir des vidéos</p>
        </>
      )}
    </section>
  )
}
