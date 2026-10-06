import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let cached: string | undefined

/**
 * The version being served (YC-106): the VERSION file at the root of the repository, written only
 * by deploy.sh. The server always runs from `server/` (npm scripts in dev, WORKDIR in the image),
 * so the file is one level up. « dev » when there is none: a working copy, never a release.
 */
export function appVersion(file = resolve(process.cwd(), '..', 'VERSION')): string {
  if (cached !== undefined) return cached
  try {
    cached = readFileSync(file, 'utf8').trim() || 'dev'
  } catch {
    cached = 'dev'
  }
  return cached
}

/** For tests only: forget the version read. */
export function resetAppVersion(): void {
  cached = undefined
}
