import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { buttonClass } from '@/components/ui/buttonStyles'
import { StatusPill, type PillTone } from '@/components/ui/StatusPill'
import { formatDuration, formatTimestamp } from '@/lib/format'
import { Highlight } from '@/features/search/Highlight'
import { useSearchField } from '@/features/search/useSearchField'
import {
  MAX_QUERY,
  MIN_QUERY,
  noteLink,
  playlistLink,
  readType,
  useSearch,
  videoLink,
  type SearchNoteLine,
  type SearchPlaylist,
  type SearchResults,
  type SearchType,
  type SearchVideo,
  type VideoState,
} from '@/features/search/search'
import searchIcon from '@/features/search/icons/search.svg'
import chevronIcon from '@/features/search/icons/chevron-right.svg'
import markerIcon from '@/features/search/icons/marker.svg'

/** A Figma icon as a mask: it takes the colour of the text, light and dark. */
function MaskIcon({ src, size = 24 }: { src: string; size?: number }) {
  const mask = `url("${src}") center / contain no-repeat`
  const style: CSSProperties = { width: size, height: size, backgroundColor: 'currentColor', mask, WebkitMask: mask }
  return <span aria-hidden="true" className="inline-block shrink-0" style={style} />
}

const STATE_LABEL: Record<VideoState, string> = { todo: '○ À voir', progress: '● En cours', seen: '✓ Vue' }
// Figma « Pastille d'état » 56:14: Contour = to do, Accent = in progress, Neutre = seen.
const STATE_TONE: Record<VideoState, PillTone> = { todo: 'outline', progress: 'accent', seen: 'neutral' }

/** The symbol is in the text (✓ ● ○) or the pill names a kind: no dot (« Point masquable »). */
function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: PillTone }) {
  return (
    <StatusPill tone={tone} dot={false}>
      {children}
    </StatusPill>
  )
}

/** A line of the results (Figma « Résultat de recherche » 108:370): the whole row opens it. */
function Row({ to, lead, title, detail, pill }: { to: string; lead: ReactNode; title: ReactNode; detail: string; pill: ReactNode }) {
  return (
    <li className="border-t border-line first:border-t-0">
      <Link to={to} className="flex items-center gap-3.5 p-3 transition-colors hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none">
        {lead}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="break-words text-[15px] font-semibold text-content sm:text-base">{title}</span>
          <span className="text-[13px] text-content-muted">{detail}</span>
        </span>
        {pill}
        <span className="text-content">
          <MaskIcon src={chevronIcon} />
        </span>
      </Link>
    </li>
  )
}

const Thumb = ({ url }: { url: string | null }) => (
  <span className="relative h-[54px] w-24 shrink-0 overflow-hidden rounded-lg border border-white/[0.12] bg-stage">
    {url && <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
  </span>
)

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-[26px] leading-tight text-content">{title}</h2>
      <ul className="overflow-hidden rounded-2xl border border-line bg-surface py-1">{children}</ul>
    </section>
  )
}

function playlistDetail(p: SearchPlaylist): string {
  return [
    p.channel,
    `${p.videoCount} vidéo${p.videoCount > 1 ? 's' : ''}`,
    `${p.completedCount}/${p.videoCount} vue${p.completedCount > 1 ? 's' : ''}`,
    p.titleMatches ? `le terme est dans ${p.titleMatches} titre${p.titleMatches > 1 ? 's' : ''}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function videoDetail(v: SearchVideo): string {
  const where = v.playlist ? `${v.playlist.title} · vidéo ${v.playlist.position} / ${v.playlist.count}` : (v.channel ?? 'Vidéo seule')
  return [where, v.durationSeconds ? formatDuration(v.durationSeconds) : null].filter(Boolean).join(' · ')
}

/** « Note de « titre » · playlist · repère 04:05 », then « Même note · repère 08:40 » for the next lines of that note. */
function noteDetail(n: SearchNoteLine, sameNote: boolean): string {
  const place = n.video
    ? n.marker !== null
      ? `repère ${formatTimestamp(n.marker)}`
      : n.section && `section ${n.section}`
    : n.section && `section ${n.section}`
  if (sameNote) return ['Même note', place].filter(Boolean).join(' · ')
  const of = n.video ? [`Note de « ${n.video.title} »`, n.video.playlist?.title] : [`Note de la playlist ${n.playlist?.title ?? ''}`.trim()]
  return [...of, place].filter(Boolean).join(' · ')
}

function notePill(n: SearchNoteLine) {
  if (n.video && n.marker !== null) return <Pill>{formatTimestamp(n.marker)}</Pill>
  if (!n.video) return <Pill>Playlist</Pill>
  return null
}

const TYPE_LABEL: Record<SearchType, string> = { all: 'Tout', playlists: 'Playlists', videos: 'Vidéos', notes: 'Notes' }

function counts(r: SearchResults): Record<SearchType, number> {
  const playlists = r.playlists.total
  const videos = r.videos.total
  const notes = r.notes.total
  return { all: playlists + videos + notes, playlists, videos, notes }
}

/** The page state « Aucun résultat » (Figma « État de page » 96:115). */
function NoResult({ query, filtered, onClear }: { query: string; filtered: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-8 py-14 text-center">
      <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-sunken text-content">
        <MaskIcon src={searchIcon} size={28} />
      </span>
      <h2 className="mt-2 font-serif text-[32px] leading-tight text-content">Aucun résultat pour « {query} »</h2>
      <p className="max-w-md text-base leading-normal text-content-muted">
        {filtered
          ? 'Rien sous ce filtre. Les autres résultats sont dans « Tout ».'
          : 'Essaie un autre mot, ou une partie du mot. La recherche couvre tes playlists, tes vidéos et tes notes.'}
      </p>
      {filtered && (
        <button type="button" onClick={onClear} className={buttonClass('primary', 'mt-2')}>
          Effacer les filtres
        </button>
      )}
    </div>
  )
}

/**
 * The search (YC-22), Figma « Recherche » 110:36166 (1440), 110:36423 (834), 110:36691 (390): the
 * user's playlists, videos and notes, the term marked; never YouTube. In the new design since YC-82
 * (sombre 110:37036); no « Catalogue » filter until YC-65. On a computer the field is in the top bar;
 * on a phone, in the page.
 */
export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const { query, draft, setDraft, submit, onKeyDown } = useSearchField()
  const type = readType(params.get('type'))
  const search = useSearch(query)
  const field = useRef<HTMLInputElement>(null)
  // Nothing searched yet: the field waits for the term (on a phone, where it is in the page).
  useEffect(() => {
    if (!query) field.current?.focus()
  }, [query])

  const setType = (next: SearchType) => {
    const nextParams = new URLSearchParams(params)
    if (next === 'all') nextParams.delete('type')
    else nextParams.set('type', next)
    setParams(nextParams)
  }

  const r = search.data
  const n = r ? counts(r) : null
  const show = (t: SearchType) => type === 'all' || type === t
  // « Même note » for the lines that follow a line of the same note.
  const notes = r?.notes.items ?? []

  return (
    <div className="min-h-[calc(100vh-64px)] bg-app">
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-24 pt-6 md:px-8 md:pb-16 md:pt-8 xl:px-16 xl:pt-10">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-mono-12 uppercase text-content-muted">
            Recherche{n ? ` · ${n.all} résultat${n.all > 1 ? 's' : ''}` : ''} · dans tes playlists et tes notes
          </p>
          <h1 className="break-words font-serif text-title-34 text-content md:text-title-56">
            {query ? `Résultats pour « ${query} »` : 'Rechercher'}
          </h1>
        </header>

        {/* On a phone the top bar has no field: it is here (Figma 390). */}
        <form role="search" onSubmit={submit} className="md:hidden">
          <label className="flex h-12 items-center gap-2.5 rounded-full border-2 border-focus bg-surface px-4 text-content">
            <MaskIcon src={searchIcon} size={20} />
            <input
              ref={field}
              type="search"
              data-search-field=""
              aria-label="Rechercher dans tes playlists, tes vidéos et tes notes"
              value={draft}
              maxLength={MAX_QUERY}
              enterKeyHint="search"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              className="min-w-0 flex-1 bg-transparent text-[15px] text-content outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {draft && (
              <button type="button" aria-label="Effacer" onClick={() => (setDraft(''), field.current?.focus())} className="flex size-8 items-center justify-center text-lg">
                ×
              </button>
            )}
          </label>
        </form>

        {query.length < MIN_QUERY ? (
          <p className="text-content-muted">Tape au moins {MIN_QUERY} caractères : un titre, une chaîne, un mot de tes notes.</p>
        ) : search.isError ? (
          <p role="alert" className="rounded-[20px] border border-line bg-surface p-6 text-body-15 text-content">
            La recherche n’a pas répondu. Réessaie dans un instant.
          </p>
        ) : !r || !n ? (
          <p className="text-content-muted">Recherche…</p>
        ) : (
          <>
            <div role="group" aria-label="Filtrer les résultats" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
              {(Object.keys(TYPE_LABEL) as SearchType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={type === t}
                  onClick={() => setType(t)}
                  className={`min-h-10 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus ${
                    type === t ? 'bg-inverse text-content-inverse' : 'border border-line text-content hover:bg-sunken'
                  }`}
                >
                  {TYPE_LABEL[t]} · {n[t]}
                </button>
              ))}
            </div>

            {n[type] === 0 ? (
              <NoResult query={query} filtered={type !== 'all' && n.all > 0} onClear={() => setType('all')} />
            ) : (
              <div className="flex flex-col gap-8">
                {show('playlists') && r.playlists.items.length > 0 && (
                  <Section title="Playlists">
                    {r.playlists.items.map((p) => (
                      <Row
                        key={p.id}
                        to={playlistLink(p)}
                        lead={<Thumb url={p.thumbnailUrl} />}
                        title={<Highlight text={p.title} query={query} />}
                        detail={playlistDetail(p)}
                        pill={<Pill>Playlist</Pill>}
                      />
                    ))}
                  </Section>
                )}
                {show('videos') && r.videos.items.length > 0 && (
                  <Section title="Vidéos">
                    {r.videos.items.map((v) => (
                      <Row
                        key={v.youtubeId}
                        to={videoLink(v)}
                        lead={<Thumb url={v.thumbnailUrl} />}
                        title={<Highlight text={v.title} query={query} />}
                        detail={videoDetail(v)}
                        pill={<Pill tone={STATE_TONE[v.state]}>{STATE_LABEL[v.state]}</Pill>}
                      />
                    ))}
                  </Section>
                )}
                {show('notes') && notes.length > 0 && (
                  <Section title="Notes">
                    {notes.map((line, i) => (
                      <Row
                        key={`${line.noteId}-${i}`}
                        to={noteLink(line)}
                        lead={
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-content">
                            <MaskIcon src={markerIcon} />
                          </span>
                        }
                        title={
                          <>
                            « <Highlight text={line.text} query={query} /> »
                          </>
                        }
                        detail={noteDetail(line, i > 0 && notes[i - 1].noteId === line.noteId)}
                        pill={notePill(line)}
                      />
                    ))}
                  </Section>
                )}
                {(['playlists', 'videos', 'notes'] as const).some((t) => show(t) && r[t].items.length < r[t].total) && (
                  <p className="text-[13px] text-content-muted">Seuls les 50 premiers de chaque groupe sont listés : précise le terme pour voir les autres.</p>
                )}
              </div>
            )}
          </>
        )}

        <p className="text-[13px] text-content-muted">La recherche couvre tes playlists, tes vidéos et tes notes. Elle ne cherche jamais dans YouTube.</p>
      </main>
    </div>
  )
}
