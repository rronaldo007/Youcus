import { prisma } from '@/lib/prisma'
import { sameNameKey } from '@/lib/playlistTitle'
import { isMerge, mergePlaylists } from '@/services/playlist.service'

/**
 * Merges the playlists of the same name imported before the automatic merge (YC-105).
 * The automatic merge only plays on the next imports: what is already doubled stays doubled
 * until this runs. A dry run by default; `apply` writes, group by group, through mergePlaylists
 * (YC-95), so the sources are kept whole and a merge already in a group takes the others in.
 */

export interface PlannedPlaylist {
  id: string
  title: string
  videoCount: number
}

export interface PlannedMerge {
  ownerId: string
  /** The merge's title: the existing merge's, else the oldest playlist's. */
  title: string
  /** The merge that takes the others in; null when a new merge is created. */
  into: string | null
  playlists: PlannedPlaylist[]
  /** Videos once merged: the same video in two playlists counts once. */
  videoCount: number
}

export interface SkippedGroup {
  ownerId: string
  title: string
  reason: string
}

export interface SameNameReport {
  applied: boolean
  merges: PlannedMerge[]
  /** Groups that cannot be merged as they are (two merges of the same name). */
  skipped: SkippedGroup[]
  /** Merges made before YC-95: their sources were never recorded, and stay visible. */
  unknownSources: PlannedPlaylist[]
  /** What failed while applying; the other groups went on. */
  failed: SkippedGroup[]
}

export async function runSameNameMerges({ apply }: { apply: boolean }): Promise<SameNameReport> {
  const rows = await prisma.playlist.findMany({
    where: { mergedIntoId: null },
    orderBy: [{ ownerId: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      ownerId: true,
      title: true,
      youtubeId: true,
      videos: { select: { videoId: true } },
      _count: { select: { sources: true } },
    },
  })

  const groups = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = `${row.ownerId}\u0000${sameNameKey(row.title)}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  const merges: PlannedMerge[] = []
  const skipped: SkippedGroup[] = []
  const grouped = new Set<string>()
  for (const members of groups.values()) {
    if (members.length < 2) continue
    const [oldest] = members
    const existing = members.filter(isMerge)
    if (existing.length > 1) {
      skipped.push({ ownerId: oldest.ownerId, title: oldest.title, reason: `${existing.length} fusions portent ce nom` })
      continue
    }
    const into = existing[0] ?? null
    // The merge first: it keeps its videos and their order, the others follow, oldest first.
    const ordered = into ? [into, ...members.filter((m) => m !== into)] : members
    for (const m of members) grouped.add(m.id)
    merges.push({
      ownerId: oldest.ownerId,
      title: into?.title ?? oldest.title,
      into: into?.id ?? null,
      playlists: ordered.map(summary),
      videoCount: new Set(members.flatMap((m) => m.videos.map((v) => v.videoId))).size,
    })
  }

  const unknownSources = rows.filter((r) => isMerge(r) && r._count.sources === 0 && !grouped.has(r.id)).map(summary)

  const failed: SkippedGroup[] = []
  if (apply) {
    for (const merge of merges) {
      try {
        await mergePlaylists(
          merge.ownerId,
          merge.playlists.map((p) => p.id),
          merge.title,
        )
      } catch (err) {
        failed.push({ ownerId: merge.ownerId, title: merge.title, reason: err instanceof Error ? err.message : String(err) })
      }
    }
  }

  return { applied: apply, merges, skipped, unknownSources, failed }
}

function summary(row: { id: string; title: string; videos: unknown[] }): PlannedPlaylist {
  return { id: row.id, title: row.title, videoCount: row.videos.length }
}

const videos = (n: number) => `${n} vidéo${n > 1 ? 's' : ''}`

/** The report as lines a person reads before saying --apply. */
export function describeReport(report: SameNameReport): string[] {
  const lines = [report.applied ? 'Fusions écrites :' : 'ESSAI, rien n’est écrit. Fusions prévues :']
  if (report.merges.length === 0) lines.push('  aucune : pas deux playlists visibles du même nom.')
  for (const m of report.merges) {
    const target = m.into ? `ajoutées à la fusion ${m.into}` : 'nouvelle fusion'
    lines.push(`  « ${m.title} » (utilisateur ${m.ownerId}, ${target}) : ${videos(m.videoCount)} une fois fusionnées`)
    for (const p of m.playlists) lines.push(`    - ${p.id} « ${p.title} », ${videos(p.videoCount)}`)
  }
  if (report.skipped.length) {
    lines.push('Groupes laissés tels quels :')
    for (const s of report.skipped) lines.push(`  « ${s.title} » (utilisateur ${s.ownerId}) : ${s.reason}`)
  }
  if (report.unknownSources.length) {
    lines.push('Fusions d’avant YC-95, sources inconnues (leurs playlists d’origine restent visibles) :')
    for (const p of report.unknownSources) lines.push(`  ${p.id} « ${p.title} », ${videos(p.videoCount)}`)
  }
  if (report.failed.length) {
    lines.push('ÉCHECS :')
    for (const f of report.failed) lines.push(`  « ${f.title} » (utilisateur ${f.ownerId}) : ${f.reason}`)
  }
  if (!report.applied && report.merges.length) lines.push('Pour écrire : relancer avec --apply.')
  return lines
}
