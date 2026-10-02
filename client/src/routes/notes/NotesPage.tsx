import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { SOON } from '@/components/layout/navItems'
import { BUTTON_BASE, buttonClass } from '@/components/ui/buttonStyles'
import { Icon } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/IconButton'
import { PageState } from '@/components/ui/PageState'
import { TimestampChip } from '@/components/ui/Timestamp'
import { PlaylistNotes } from '@/features/notes/PlaylistNotes'
import { VideoNotes } from '@/features/notes/VideoNotes'
import { NOTES_KEY, useNotes, type NoteCard as Card } from '@/features/notes/useNotes'
import { formatRelativeDay, formatTimestamp } from '@/lib/format'

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

/** The playlists the notes belong to, in the order they first appear (the most recent first). */
function playlistsOf(notes: Card[]): { id: string; title: string }[] {
  const seen = new Map<string, string>()
  for (const n of notes) {
    if (n.kind === 'playlist') seen.set(n.playlist.id, seen.get(n.playlist.id) ?? n.playlist.title)
    else for (const p of n.playlists) if (!seen.has(p.id)) seen.set(p.id, p.title)
  }
  return [...seen].map(([id, title]) => ({ id, title }))
}

function inPlaylist(n: Card, id: string): boolean {
  return n.kind === 'playlist' ? n.playlist.id === id : n.playlists.some((p) => p.id === id)
}

/**
 * One note (Figma « Mes notes » 16:807): where it comes from, its title (the note page), its first
 * line, three markers that open the video at their moment, when it changed, and « Agrandir ».
 */
function NoteCardView({ note, filter, onExpand }: { note: Card; filter: string | null; onExpand: (button: HTMLButtonElement) => void }) {
  let eyebrow: string
  let title: string
  let pageTo: string
  let open: { to: string; label: string }
  let watch: ((seconds?: number) => string) | null = null
  if (note.kind === 'video') {
    // The place of the video in the playlist chosen above, else in the first one that holds it.
    const where = note.playlists.find((p) => p.id === filter) ?? note.playlists[0]
    eyebrow = where ? `${where.title} · Vidéo ${where.position + 1}` : 'Vidéo seule'
    title = note.video.title
    pageTo = `/notes/videos/${note.video.id}${where ? `?playlist=${where.id}` : ''}`
    const base = where ? `/playlists/${where.id}/watch/${note.video.youtubeId}` : `/videos/${note.video.youtubeId}`
    watch = (seconds) => (seconds === undefined ? base : `${base}?t=${seconds}`)
    // The player resumes where the user stopped (decision of Ronaldo, 02/10).
    open = { to: base, label: 'Rouvrir la vidéo' }
  } else {
    eyebrow = `Note de playlist · ${plural(note.playlist.videoCount, 'vidéo')}`
    title = note.playlist.title
    pageTo = `/notes/playlists/${note.playlist.id}`
    open = { to: pageTo, label: 'Ouvrir la note' }
  }
  const markers = note.kind === 'video' ? note.markerCount : null
  return (
    <article aria-label={title} className="relative flex min-w-0 flex-col gap-3 rounded-[20px] border border-line bg-surface px-6 pb-5 pt-6">
      <p className="pr-12 font-mono text-mono-12 uppercase text-content-muted">{eyebrow}</p>
      <h2 className="pr-12 font-serif text-title-24 text-content">
        <Link to={pageTo} className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
          {title}
        </Link>
      </h2>
      {note.excerpt && <p className="line-clamp-2 text-body-15 text-content">{note.excerpt}</p>}
      {note.kind === 'video' && note.markers.length > 0 && watch && (
        <ul className="flex flex-col gap-3">
          {note.markers.map((m, i) => (
            <li key={`${m.seconds}-${i}`} className="flex min-w-0 items-center gap-2.5">
              <Link to={watch(m.seconds)} aria-label={`Ouvrir la vidéo à ${formatTimestamp(m.seconds)}`} className="rounded-yc-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
                <TimestampChip seconds={m.seconds} className="hover:bg-accent-hover" />
              </Link>
              <span className="truncate text-body-15 text-content-muted">{m.text || 'Ligne vide'}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <p className="text-small-13 font-medium text-content-muted">
          {[`Modifiée ${formatRelativeDay(note.updatedAt)}`, markers !== null && plural(markers, 'repère')].filter(Boolean).join(' · ')}
        </p>
        <Link to={open.to} className={buttonClass('ghost')}>
          {open.label} →
        </Link>
      </div>
      <IconButton icon="expand" label={`Agrandir la note : ${title}`} className="absolute right-[11px] top-[11px]" onClick={(e) => onExpand(e.currentTarget)} />
    </article>
  )
}

/**
 * « Mes notes » (Figma 16:756, 16:885, 16:994 ; sombre 45:6866 ; vide 98:30317, YC-78): every note of
 * the user, the most recent first, filtered by playlist. « Agrandir » opens the note in its expanded
 * view (YC-18) here, without leaving the list.
 */
export function NotesPage() {
  const { data, isLoading, isError } = useNotes()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<string | null>(null)
  const [open, setOpen] = useState<Card | null>(null)
  const returnTo = useRef<HTMLButtonElement | null>(null)

  // A reload with the expanded view in the address has no note to open: the address is cleaned.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('note') !== 'agrandie') return
    url.searchParams.delete('note')
    window.history.replaceState(window.history.state, '', url)
  }, [])

  function expand(note: Card, button: HTMLButtonElement) {
    returnTo.current = button
    // The editor reads the address when it mounts, and opens in its expanded view (YC-18).
    const url = new URL(window.location.href)
    url.searchParams.set('note', 'agrandie')
    window.history.pushState({ ...window.history.state, ycNote: true }, '', url)
    setOpen(note)
  }
  function closed() {
    setOpen(null)
    // What was written in the expanded view shows on its card.
    void queryClient.invalidateQueries({ queryKey: NOTES_KEY })
    returnTo.current?.focus()
  }

  if (isLoading) return <p className="p-6 text-content-muted">Chargement…</p>
  if (isError || !data) {
    return (
      <main className="mx-auto w-full max-w-[1440px] px-4 pt-8 md:px-8 xl:px-16">
        <PageState kind="error" title="Notes indisponibles" text="Le serveur n’a pas répondu. Tes notes, elles, sont enregistrées." action={{ label: 'Retour au tableau de bord', to: '/' }} />
      </main>
    )
  }

  const { notes, totals } = data
  const playlists = playlistsOf(notes)
  const shown = filter ? notes.filter((n) => inPlaylist(n, filter)) : notes
  const eyebrow = totals.notes === 0 ? 'Aucune note encore' : [plural(totals.notes, 'note'), plural(totals.markers, 'repère'), plural(totals.playlists, 'playlist')].join(' · ')
  const chip = (id: string | null, label: string) => (
    <button key={id ?? 'recent'} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={buttonClass(filter === id ? 'primary' : 'secondary')}>
      {label}
    </button>
  )

  return (
    <div className="min-h-[calc(100vh-64px)] bg-app">
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-16 pt-6 md:px-8 md:pt-8 xl:px-16 xl:pt-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <p className="font-mono text-mono-12 uppercase text-content-muted">{eyebrow}</p>
            <h1 className="font-serif text-title-34 text-content md:text-title-56">Mes notes</h1>
          </div>
          {/* One file with every note: the same work as YC-86, which carries it (decision of Ronaldo, 02/10). */}
          <span aria-disabled="true" title={SOON} className={`${BUTTON_BASE} cursor-not-allowed self-start border border-line-strong text-content opacity-45 md:self-auto`}>
            Exporter en .docx · Bientôt
          </span>
        </header>

        {totals.notes === 0 ? (
          <section className="flex flex-col items-center gap-4 px-8 py-14 text-center">
            <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-sunken text-content">
              <Icon name="plus" size={28} />
            </span>
            <h2 className="mt-2 font-serif text-[32px] leading-tight text-content">Ton cahier est vide</h2>
            <p className="max-w-[640px] text-[16px] leading-normal text-content-muted">
              Ouvre une vidéo et appuie sur M au moment qui compte : le repère garde l’heure exacte, la note se remplit après.
            </p>
            <Link to="/" className={buttonClass('primary', 'mt-2')}>
              Ouvrir le tableau de bord
            </Link>
          </section>
        ) : (
          <>
            <div role="group" aria-label="Filtrer les notes" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
              {chip(null, 'Récentes')}
              {playlists.map((p) => chip(p.id, p.title))}
            </div>
            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
              {shown.map((n) => (
                <NoteCardView key={n.id} note={n} filter={filter} onExpand={(button) => expand(n, button)} />
              ))}
            </div>
          </>
        )}
      </main>
      {open?.kind === 'video' && (
        <VideoNotes
          modalOnly
          videoId={open.video.id}
          onClose={closed}
          context={{ eyebrow: open.playlists[0] ? `${open.playlists[0].title} · Vidéo ${open.playlists[0].position + 1}` : 'Vidéo seule', heading: open.video.title }}
        />
      )}
      {open?.kind === 'playlist' && (
        <PlaylistNotes modalOnly playlistId={open.playlist.id} onClose={closed} context={{ eyebrow: 'Note de playlist', heading: open.playlist.title }} />
      )}
    </div>
  )
}
