import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * La connexion ne doit demander que l'identité (scopes non sensibles) : c'est ce qui
 * permet à n'importe quel compte Google de se connecter sans que l'application soit
 * vérifiée par Google. Le scope YouTube, sensible, n'est demandé qu'au moment de
 * l'import, en autorisation incrémentale.
 */

const CALLBACK = 'http://localhost:4000/api/auth/google/callback'

async function loadModule() {
  vi.resetModules()
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
  process.env.GOOGLE_CALLBACK_URL = CALLBACK
  return import('@/lib/googleOAuth')
}

describe('buildGoogleAuthUrl', () => {
  beforeEach(() => vi.resetModules())

  it('mode login : identité seule, sans le scope YouTube, choix du compte', async () => {
    const { buildGoogleAuthUrl, YOUTUBE_SCOPE } = await loadModule()
    const url = new URL(buildGoogleAuthUrl('abc:login'))

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('scope')).toBe('openid email profile')
    expect(url.searchParams.get('scope')).not.toContain(YOUTUBE_SCOPE)
    expect(url.searchParams.get('prompt')).toBe('select_account')
    expect(url.searchParams.get('access_type')).toBeNull()
    expect(url.searchParams.get('state')).toBe('abc:login')
    expect(url.searchParams.get('redirect_uri')).toBe(CALLBACK)
  })

  it('mode youtube : ajoute youtube.readonly en incrémental, hors ligne, avec consentement', async () => {
    const { buildGoogleAuthUrl, YOUTUBE_SCOPE } = await loadModule()
    const url = new URL(buildGoogleAuthUrl('abc:youtube', 'youtube'))

    expect(url.searchParams.get('scope')).toBe(`openid email profile ${YOUTUBE_SCOPE}`)
    expect(url.searchParams.get('include_granted_scopes')).toBe('true')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
  })
})

describe('exchangeCodeForTokens', () => {
  const originalFetch = globalThis.fetch

  function mockGoogle(scope: string) {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify({ id: 'g1', email: 'a@b.c', name: 'Ada' }), { status: 200 })
    }) as typeof fetch
  }

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('signale youtubeGranted=false quand seule l\'identité a été accordée', async () => {
    const { exchangeCodeForTokens } = await loadModule()
    mockGoogle('openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile')

    const result = await exchangeCodeForTokens('code')
    expect(result.profile).toEqual({ googleId: 'g1', email: 'a@b.c', displayName: 'Ada', avatarUrl: null })
    expect(result.youtubeGranted).toBe(false)
  })

  it('signale youtubeGranted=true quand le scope YouTube figure dans la réponse', async () => {
    const { exchangeCodeForTokens, YOUTUBE_SCOPE } = await loadModule()
    mockGoogle(`openid email profile ${YOUTUBE_SCOPE}`)

    const result = await exchangeCodeForTokens('code')
    expect(result.youtubeGranted).toBe(true)
    expect(result.tokens.refreshToken).toBe('rt')
  })
})
