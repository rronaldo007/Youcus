import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  fileURLToPath(new URL('../prisma/migrations/20261003000000_user_youtube_expired/migration.sql', import.meta.url)),
  'utf-8',
)

describe('migration user_youtube_expired (YC-84)', () => {
  it('adds the nullable date of a dead YouTube token to User', () => {
    expect(sql).toMatch(/ALTER TABLE `User` ADD COLUMN `ytExpiredAt` DATETIME\(3\) NULL/)
  })

  it('only adds: no DROP, no data rewritten, so the accounts in prod keep everything', () => {
    expect(sql).not.toMatch(/DROP|UPDATE|DELETE|MODIFY/i)
  })
})
