import { afterEach, describe, expect, it, vi } from 'vitest'

const run = vi.hoisted(() => vi.fn(async () => null))
vi.mock('@/jobs/refreshMetadata', () => ({ runMetadataRefresh: run }))

async function load(env: Record<string, unknown>, youtube: boolean) {
  vi.resetModules()
  vi.doMock('@/config/env', () => ({ env, isYouTubeConfigured: () => youtube }))
  return (await import('@/jobs/scheduler')).startMetadataRefresh
}

describe('startMetadataRefresh (YC-8)', () => {
  afterEach(() => {
    vi.useRealTimers()
    run.mockClear()
  })

  it('runs one minute after boot, then every day', async () => {
    vi.useFakeTimers()
    const start = await load({ NODE_ENV: 'production', METADATA_REFRESH: 'on' }, true)
    const stop = start()
    await vi.advanceTimersByTimeAsync(59_000)
    expect(run).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(run).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(24 * 3600 * 1000)
    expect(run).toHaveBeenCalledTimes(2)
    stop()
  })

  it('stays off in tests, without a YouTube key, or with METADATA_REFRESH=off', async () => {
    vi.useFakeTimers()
    for (const [env, youtube] of [
      [{ NODE_ENV: 'test', METADATA_REFRESH: 'on' }, true],
      [{ NODE_ENV: 'production', METADATA_REFRESH: 'on' }, false],
      [{ NODE_ENV: 'production', METADATA_REFRESH: 'off' }, true],
    ] as const) {
      const start = await load(env, youtube)
      start()
      await vi.advanceTimersByTimeAsync(2 * 24 * 3600 * 1000)
    }
    expect(run).not.toHaveBeenCalled()
  })
})
