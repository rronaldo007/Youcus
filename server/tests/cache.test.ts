import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Le cache est testé contre un faux client Redis en mémoire, avec un temps
 * simulé : on vérifie le comportement (hit, miss, expiration, panne) sans
 * dépendre d'un serveur Redis réel — les tests doivent tourner en CI.
 */

let now = 0
const store = new Map<string, { value: string; expiresAt: number }>()
let failNext: 'get' | 'set' | 'del' | null = null
// Status of the next client created: 'connecting' reproduces the boot of the API (YC-33).
let initialStatus = 'ready'
const clients: FakeRedis[] = []

class FakeRedis extends EventEmitter {
  status = initialStatus
  constructor() {
    super()
    clients.push(this)
  }
  // Like ioredis with enableOfflineQueue: false, a command fails until the connection is ready.
  private assertWritable() {
    if (this.status !== 'ready') throw new Error("Stream isn't writeable and enableOfflineQueue options is false")
  }
  async quit() {
    return 'OK'
  }
  async get(key: string) {
    this.assertWritable()
    if (failNext === 'get') throw new Error('ECONNREFUSED')
    const entry = store.get(key)
    if (!entry) return null
    if (entry.expiresAt <= now) {
      store.delete(key)
      return null
    }
    return entry.value
  }
  async set(key: string, value: string, _mode: string, ttl: number) {
    this.assertWritable()
    if (failNext === 'set') throw new Error('ECONNREFUSED')
    store.set(key, { value, expiresAt: now + ttl })
    return 'OK'
  }
  async del(key: string) {
    this.assertWritable()
    if (failNext === 'del') throw new Error('ECONNREFUSED')
    return store.delete(key) ? 1 : 0
  }
}

vi.mock('ioredis', () => ({ default: FakeRedis }))
vi.mock('@/config/env', () => ({ env: { REDIS_URL: 'redis://localhost:6379' } }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}))

const { cacheAside, invalidate, playlistKey, closeCache } = await import('@/lib/cache')

beforeEach(async () => {
  await closeCache()
  store.clear()
  failNext = null
  now = 0
  initialStatus = 'ready'
  clients.length = 0
})

describe('playlistKey', () => {
  it('préfixe la clé pour permettre une purge par motif', () => {
    expect(playlistKey('PL123')).toBe('yt:playlist:PL123')
  })
})

describe('cacheAside', () => {
  it('miss : appelle la source une fois et mémorise le résultat', async () => {
    const loader = vi.fn().mockResolvedValue({ title: 'Ma playlist' })

    await expect(cacheAside('k', loader, 60)).resolves.toEqual({ title: 'Ma playlist' })
    expect(loader).toHaveBeenCalledTimes(1)
    expect(store.has('k')).toBe(true)
  })

  it("hit : le deuxième appel ne touche plus la source", async () => {
    const loader = vi.fn().mockResolvedValue({ title: 'Ma playlist' })

    await cacheAside('k', loader, 60)
    await expect(cacheAside('k', loader, 60)).resolves.toEqual({ title: 'Ma playlist' })
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('expiration : passé la durée de vie, la source est réinterrogée', async () => {
    const loader = vi.fn().mockResolvedValue({ title: 'Ma playlist' })

    await cacheAside('k', loader, 60)
    now = 61
    await cacheAside('k', loader, 60)

    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('sérialise et restaure les structures imbriquées', async () => {
    const data = { title: 'P', videos: [{ youtubeId: 'a', position: 0 }] }
    await cacheAside('k', async () => data, 60)

    const relu = await cacheAside('k', async () => ({ title: 'PERIME' }) as typeof data, 60)
    expect(relu).toEqual(data)
  })
})

describe('dégradation quand Redis est en panne', () => {
  it('lecture impossible : la source répond quand même', async () => {
    failNext = 'get'
    const loader = vi.fn().mockResolvedValue({ title: 'Ma playlist' })

    await expect(cacheAside('k', loader, 60)).resolves.toEqual({ title: 'Ma playlist' })
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("écriture impossible : la valeur est renvoyée sans lever d'erreur", async () => {
    failNext = 'set'
    await expect(cacheAside('k', async () => 42, 60)).resolves.toBe(42)
  })

  it('invalidation impossible : aucune erreur ne remonte', async () => {
    failNext = 'del'
    await expect(invalidate('k')).resolves.toBeUndefined()
  })
})

describe('invalidate', () => {
  it('force la relecture depuis la source au rafraîchissement manuel', async () => {
    const loader = vi.fn().mockResolvedValue({ title: 'Ma playlist' })

    await cacheAside('k', loader, 3600)
    await invalidate('k')
    await cacheAside('k', loader, 3600)

    expect(loader).toHaveBeenCalledTimes(2)
  })
})

describe('first connection (YC-33)', () => {
  afterEach(() => vi.useRealTimers())

  it('waits for the first connection instead of losing the first command after boot', async () => {
    initialStatus = 'connecting'
    store.set('k', { value: '"stale"', expiresAt: 3600 })

    const pending = invalidate('k')
    await Promise.resolve()
    clients[0].status = 'ready'
    clients[0].emit('ready')
    await pending

    expect(store.has('k')).toBe(false)
  })

  it('gives up after the connect timeout: the source answers', async () => {
    vi.useFakeTimers()
    initialStatus = 'connecting'
    const loader = vi.fn().mockResolvedValue(42)

    const pending = cacheAside('k', loader, 60)
    await vi.advanceTimersByTimeAsync(1000)

    await expect(pending).resolves.toBe(42)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('never waits for a Redis that is down after boot', async () => {
    vi.useFakeTimers()
    initialStatus = 'reconnecting'
    const loader = vi.fn().mockResolvedValue(42)

    // No timer is advanced: if the cache waited, this would never resolve.
    await expect(cacheAside('k', loader, 60)).resolves.toBe(42)
  })
})
