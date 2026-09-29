import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = fileURLToPath(new URL('../prisma/migrations/', import.meta.url))
const folder = readdirSync(dir).find((name) => name.endsWith('_video_metadata'))
const sql = folder ? readFileSync(`${dir}${folder}/migration.sql`, 'utf-8') : ''

describe('video metadata migration (YC-2)', () => {
  it('exists', () => {
    expect(folder).toBeDefined()
  })

  it('only adds: no dropped table, column or index', () => {
    expect(sql).not.toMatch(/\bDROP\b/i)
    expect(sql).not.toMatch(/\bRENAME\b/i)
  })

  it('creates the Channel and Chapter tables', () => {
    expect(sql).toContain('CREATE TABLE `Channel`')
    expect(sql).toContain('CREATE TABLE `Chapter`')
    expect(sql).toContain('Chapter_videoId_position_key')
  })

  it('keeps likes and views nullable, never a fake 0', () => {
    expect(sql).toContain('`likeCount` INTEGER NULL')
    expect(sql).toContain('`viewCount` INTEGER NULL')
  })

  it('caps the creator note at 280 characters', () => {
    expect(sql).toContain('`creatorNote` VARCHAR(280) NULL')
  })

  it('never deletes a video or playlist when its channel goes away', () => {
    expect(sql).toMatch(/Video_channelId_fkey[^;]*ON DELETE SET NULL/)
    expect(sql).toMatch(/Playlist_channelId_fkey[^;]*ON DELETE SET NULL/)
  })

  it('deletes chapters with their video', () => {
    expect(sql).toMatch(/Chapter_videoId_fkey[^;]*ON DELETE CASCADE/)
  })
})
