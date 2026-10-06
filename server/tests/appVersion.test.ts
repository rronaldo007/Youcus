import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '@/app'
import { appVersion, resetAppVersion } from '@/lib/appVersion'

describe('appVersion (YC-106)', () => {
  afterEach(() => resetAppVersion())

  it('reads the VERSION file written by deploy.sh, without its newline', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'yc-version-')), 'VERSION')
    writeFileSync(file, '1.0.0\n')
    expect(appVersion(file)).toBe('1.0.0')
  })

  it('says « dev » when there is no VERSION: a working copy, never a release', () => {
    expect(appVersion(join(tmpdir(), 'no-such-dir', 'VERSION'))).toBe('dev')
  })

  it('says « dev » for an empty file rather than an empty version', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'yc-version-')), 'VERSION')
    writeFileSync(file, '  \n')
    expect(appVersion(file)).toBe('dev')
  })

  it('GET /api/health gives the version served', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'yc-version-')), 'VERSION')
    writeFileSync(file, '2.3.4\n')
    appVersion(file)
    const res = await request(createApp()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok', version: '2.3.4' })
  })
})
