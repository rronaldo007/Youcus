import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  fileURLToPath(new URL('../prisma/migrations/20261001120000_user_note_preferences/migration.sql', import.meta.url)),
  'utf-8',
)

describe('migration user_note_preferences (YC-48)', () => {
  it('adds the nullable JSON column of the note settings to User', () => {
    expect(sql).toMatch(/ALTER TABLE `User` ADD COLUMN `notePreferences` JSON NULL/)
  })

  it('only adds: no DROP, no data rewritten, so the accounts in prod keep everything', () => {
    expect(sql).not.toMatch(/DROP|UPDATE|DELETE|MODIFY/i)
  })
})
