import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  fileURLToPath(new URL('../prisma/migrations/0_init/migration.sql', import.meta.url)),
  'utf-8',
)

describe('migration initiale (0_init)', () => {
  it('crée les 5 tables du modèle métier', () => {
    for (const table of ['User', 'Playlist', 'Video', 'Note', 'Progress']) {
      expect(sql).toContain(`CREATE TABLE \`${table}\``)
    }
  })

  it('applique les suppressions en cascade (RGPD)', () => {
    expect(sql).toContain('ON DELETE CASCADE')
  })

  it('impose une note unique par (auteur, vidéo) et (auteur, playlist)', () => {
    expect(sql).toContain('Note_authorId_videoId_key')
    expect(sql).toContain('Note_authorId_playlistId_key')
  })
})
