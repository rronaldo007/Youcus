import { afterEach, describe, expect, it, vi } from 'vitest'
import { localDay, reportStudySeconds } from './studyLog'

describe('reportStudySeconds (YC-79)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends the whole seconds of the day, kept alive with a page that closes', () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    reportStudySeconds(15.4)
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/study$/)
    expect(init.method).toBe('POST')
    expect(init.keepalive).toBe(true)
    expect(JSON.parse(init.body as string)).toEqual({ day: localDay(), seconds: 15 })
  })

  it('nothing under a second, and never more than the server takes', () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    reportStudySeconds(0.4)
    expect(fetch).not.toHaveBeenCalled()
    reportStudySeconds(500)
    expect(JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).seconds).toBe(120)
  })
})
