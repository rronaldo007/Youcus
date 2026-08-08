import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Le schema d'environnement donne une valeur par defaut au secret de session,
 * pour qu'un `npm run dev` demarre sans configuration. En production ce defaut
 * serait une faille : la chaine est publique dans le depot, donc un tiers
 * pourrait forger un cookie de session signe et usurper n'importe quel compte.
 *
 * Ces tests verifient le garde-fou qui refuse ce cas, et lui seul. Une garantie
 * non testee n'est qu'une intention : c'est la meme regle que pour la
 * degradation du cache (voir cache.test.ts).
 */

const DEV_SECRET = 'dev-secret-change-me'

/** Recharge `@/config/env` avec un environnement fabrique pour le test. */
async function chargerEnv(vars: Record<string, string | undefined>) {
  vi.resetModules()
  const sauvegarde = { ...process.env }
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  try {
    return await import('@/config/env')
  } finally {
    process.env = sauvegarde
  }
}

describe('garde-fou SESSION_SECRET', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.resetModules())

  it('refuse de demarrer en production avec le secret de developpement', async () => {
    await expect(
      chargerEnv({ NODE_ENV: 'production', SESSION_SECRET: DEV_SECRET }),
    ).rejects.toThrow(/SESSION_SECRET/)
  })

  it('refuse aussi quand SESSION_SECRET est absent en production', async () => {
    // Absent, le schema applique le defaut : on retombe sur le meme cas.
    await expect(
      chargerEnv({ NODE_ENV: 'production', SESSION_SECRET: undefined }),
    ).rejects.toThrow(/SESSION_SECRET/)
  })

  it('demarre en production avec un vrai secret', async () => {
    const mod = await chargerEnv({
      NODE_ENV: 'production',
      SESSION_SECRET: 'un-secret-de-production-suffisamment-long',
    })
    expect(mod.env.SESSION_SECRET).not.toBe(DEV_SECRET)
  })

  it('laisse passer le defaut en developpement', async () => {
    const mod = await chargerEnv({ NODE_ENV: 'development', SESSION_SECRET: undefined })
    expect(mod.env.SESSION_SECRET).toBe(DEV_SECRET)
  })
})

describe('validation de GOOGLE_CALLBACK_URL', () => {
  beforeEach(() => vi.resetModules())

  it('rejette une valeur qui n est pas une URL', async () => {
    await expect(
      chargerEnv({ NODE_ENV: 'development', GOOGLE_CALLBACK_URL: 'localhost:4000/callback' }),
    ).rejects.toThrow()
  })

  it('accepte une URL complete', async () => {
    const mod = await chargerEnv({
      NODE_ENV: 'development',
      GOOGLE_CALLBACK_URL: 'http://localhost:4000/api/auth/google/callback',
    })
    expect(mod.env.GOOGLE_CALLBACK_URL).toContain('/api/auth/google/callback')
  })
})
