import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PageState } from '@/components/ui/PageState'
import { buttonClass } from '@/components/ui/buttonStyles'
import { useCurrentUser } from '@/features/auth/useCurrentUser'
import { formatHoursMinutes, formatLongDay, formatMinutes, formatShortDay } from '@/features/stats/statsFormat'
import { useStats, type Stats, type StatsRange } from '@/features/stats/useStats'

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
/** The tallest bar of the chart, in px (Figma 17:729: 68 min drawn 129 px). */
const BAR_MAX = 130
const SCALE_MIN_SECONDS = 3600

const card = 'flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-6 md:p-7'

/**
 * Figma « Statistiques » 17:663 (YC-79): what the study log and the progress really hold. The log
 * started on 3 October: a day before it is « not counted », never « nothing studied ».
 */
export function StatsPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser()
  const [range, setRange] = useState<StatsRange>('week')
  const stats = useStats(range)

  if (userLoading) return null
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="min-h-[calc(100vh-64px)] bg-app">
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pb-16 pt-6 md:px-8 md:pt-8 xl:px-16 xl:pt-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h1 className="font-serif text-title-34 text-content md:text-title-56">Ta progression</h1>
          <div role="radiogroup" aria-label="Période" className="flex gap-2">
            {(
              [
                ['week', 'Cette semaine'],
                ['month', 'Ce mois'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={range === value}
                onClick={() => setRange(value)}
                className={buttonClass(range === value ? 'primary' : 'secondary')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {stats.isError ? (
          <PageState
            kind="error"
            title="Les statistiques ne se chargent pas"
            text="Ton temps d’étude est enregistré ; c’est l’affichage qui n’a pas répondu."
            action={{ label: 'Réessayer', onClick: () => void stats.refetch() }}
          />
        ) : stats.data ? (
          <StatsBody stats={stats.data} />
        ) : (
          <p className="text-body-15 text-content-muted">Chargement…</p>
        )}
      </main>
    </div>
  )
}

function StatsBody({ stats }: { stats: Stats }) {
  const week = stats.range === 'week'
  return (
    <>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
        <StudyCard stats={stats} />
        <section aria-labelledby="minutes-titre" className={`${card} min-w-0 flex-1`}>
          <h2 id="minutes-titre" className="font-serif text-title-24 text-content">
            Minutes par jour
          </h2>
          <DaysChart stats={stats} labels={week ? 'weekday' : 'date'} />
        </section>
      </div>
      <PlaylistTable playlists={stats.playlists} />
    </>
  )
}

function StudyCard({ stats }: { stats: Stats }) {
  const week = stats.range === 'week'
  // Weekly: the month shows no goal (the condition is in the JSX below).
  const goal = stats.goalMinutes
  const studiedMinutes = stats.totalSeconds / 60
  const facts = [
    `${stats.streakDays} jour${stats.streakDays > 1 ? 's' : ''} d’affilée`,
    stats.completedCount === 0 ? 'aucune vidéo terminée' : `${stats.completedCount} vidéo${stats.completedCount > 1 ? 's' : ''} terminée${stats.completedCount > 1 ? 's' : ''}`,
  ]
  // The log started after the beginning of the range: say it, so a short total is not read as idleness.
  if (stats.from < stats.since) facts.push(`compté depuis le ${formatShortDay(stats.since)}`)

  return (
    <section aria-labelledby="temps-titre" className={`${card} xl:w-[520px] xl:shrink-0`}>
      <h2 id="temps-titre" className="font-mono text-mono-12 uppercase text-content-muted">
        Temps d’étude · {week ? 'cette semaine' : 'ce mois'}
      </h2>
      <p className="font-serif text-[72px] leading-[72px] tracking-[-0.03em] text-content md:text-display">{formatHoursMinutes(stats.totalSeconds)}</p>
      {week &&
        (goal ? (
          <>
            <p className="text-lead text-accent-text">
              {studiedMinutes >= goal
                ? `Objectif de ${formatMinutes(goal)} atteint.`
                : `Encore ${formatMinutes(goal - studiedMinutes)} pour ton objectif de ${formatMinutes(goal)}.`}
            </p>
            <div
              role="progressbar"
              aria-label="Objectif de la semaine"
              aria-valuemin={0}
              aria-valuemax={goal}
              aria-valuenow={Math.min(goal, Math.floor(studiedMinutes))}
              className="h-2 w-full overflow-hidden rounded-[4px] bg-sunken"
            >
              <div className="h-full bg-accent" style={{ width: `${Math.min(100, (studiedMinutes / goal) * 100)}%` }} />
            </div>
          </>
        ) : (
          // The goal lives in the settings: the way there, from where it is missing (rule 17).
          <Link to="/settings#etude" className="self-start text-body-15 font-medium text-content underline underline-offset-2 hover:text-accent-text">
            Fixer un objectif pour la semaine
          </Link>
        ))}
      <p className="text-small-13 font-medium text-content-muted">{facts.join(' · ')}</p>
    </section>
  )
}

function DaysChart({ stats, labels }: { stats: Stats; labels: 'weekday' | 'date' }) {
  // At least an hour high: one short day alone must not stand as tall as a full one.
  const max = Math.max(SCALE_MIN_SECONDS, ...stats.days.map((d) => d.seconds ?? 0))
  const many = stats.days.length > 7
  return (
    <ol aria-label="Minutes par jour" className={`flex min-h-[200px] flex-1 items-end ${many ? 'gap-0.5 md:gap-1' : 'justify-between gap-2'}`}>
      {stats.days.map((d, i) => {
        const minutes = d.seconds === null ? null : Math.round(d.seconds / 60)
        // « — » is for a day without study; a few seconds say « <1 », as the total says 0 h 00.
        const shown = d.seconds === null ? '' : d.seconds === 0 ? '—' : minutes === 0 ? '<1' : String(minutes)
        const today = d.day === stats.today
        const label = labels === 'weekday' ? WEEKDAYS[i] : String(Number(d.day.slice(8)))
        // In a month, a label every week and today's: thirty would not fit on a phone.
        const showLabel = !many || i % 7 === 0 || today
        const said = d.seconds === null ? 'pas compté' : d.seconds === 0 ? '0 min' : `${shown} min`
        return (
          <li key={d.day} className={`flex flex-col items-center gap-2 ${many ? 'min-w-0 flex-1' : ''}`}>
            <span className="sr-only">{`${formatLongDay(d.day)} : ${said}`}</span>
            {!many && (
              <span aria-hidden="true" className="font-mono text-mono-12 text-content-muted">
                {shown}
              </span>
            )}
            <span
              aria-hidden="true"
              data-bar=""
              className={`block rounded-[6px] ${many ? 'w-full max-w-10' : 'w-10'} ${
                d.seconds === null ? '' : d.seconds === 0 ? 'bg-line' : today ? 'bg-accent' : 'bg-line-strong opacity-85'
              }`}
              style={{ height: d.seconds === null ? 0 : d.seconds === 0 ? 3 : Math.max(6, Math.round((d.seconds / max) * BAR_MAX)) }}
            />
            <span aria-hidden="true" className={`text-label-14 font-semibold ${today ? 'text-accent-text' : 'text-content-muted'} ${showLabel ? '' : 'invisible'}`}>
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function PlaylistTable({ playlists }: { playlists: Stats['playlists'] }) {
  const cell = 'w-[140px] shrink-0 text-right font-mono text-mono-12'
  return (
    <div role="table" aria-label="Par playlist" className="flex flex-col rounded-[20px] border border-line bg-surface px-5 py-3 md:px-7">
      <div role="row" className="flex items-center gap-4 py-3.5 font-mono text-mono-12 uppercase text-content-muted">
        <span role="columnheader" className="min-w-0 flex-1">
          Playlist
        </span>
        <span role="columnheader" className="w-16 shrink-0 text-right md:w-[140px]">
          Vues
        </span>
        <span role="columnheader" className={`${cell} hidden md:block`}>
          Restantes
        </span>
        <span role="columnheader" className="w-[72px] shrink-0 text-right md:w-[160px]" title="Durée des vidéos vues et position dans les autres, sur la durée totale">
          Avancée
        </span>
      </div>
      {playlists.length === 0 ? (
        <p className="border-t border-line py-3.5 text-body-15 text-content-muted">Importe une playlist pour la suivre ici.</p>
      ) : (
        playlists.map((p) => (
          <div role="row" key={p.id} className="flex items-center gap-4 border-t border-line py-3.5 text-content">
            <span role="cell" className="min-w-0 flex-1 truncate text-body-15">
              {p.title}
            </span>
            <span role="cell" className="w-16 shrink-0 text-right font-mono text-mono-12 md:w-[140px]">
              {p.seen}/{p.total}
            </span>
            <span role="cell" className={`${cell} hidden md:block`}>
              {p.total - p.seen}
            </span>
            <span role="cell" className="w-[72px] shrink-0 whitespace-nowrap text-right font-mono text-mono-12 md:w-[160px]">
              {formatHoursMinutes(p.advancedSeconds)}
              {/* The length too from a tablet; a phone keeps the time only, as Figma 17:1109 does. */}
              <span className="hidden md:inline"> sur {formatHoursMinutes(p.totalSeconds)}</span>
            </span>
          </div>
        ))
      )}
    </div>
  )
}
