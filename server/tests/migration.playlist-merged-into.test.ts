import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  fileURLToPath(new URL('../prisma/migrations/20261006100000_playlist_merged_into/migration.sql', import.meta.url)),
  'utf-8',
)

describe('migration playlist_merged_into (YC-95)', () => {
  it('adds the nullable merge of a playlist, indexed', () => {
    expect(sql).toMatch(/ALTER TABLE `Playlist` ADD COLUMN `mergedIntoId` VARCHAR\(191\) NULL/)
    expect(sql).toContain('CREATE INDEX `Playlist_mergedIntoId_idx`')
  })

  it('deleting a merge shows its sources again instead of deleting them', () => {
    expect(sql).toMatch(/FOREIGN KEY \(`mergedIntoId`\) REFERENCES `Playlist`\(`id`\) ON DELETE SET NULL/)
  })

  it('only adds: no DROP, no data rewritten, so the accounts in prod keep everything', () => {
    expect(sql).not.toMatch(/DROP|UPDATE `|DELETE FROM|MODIFY/i)
  })
})
