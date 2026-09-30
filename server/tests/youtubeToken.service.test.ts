import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { refreshAccessToken } from '@/lib/googleOAuth'
import { optionalAccessToken } from '@/services/youtubeToken.service'

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/googleOAuth', () => ({ refreshAccessToken: vi.fn() }))

describe('optionalAccessToken (YC-30)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns undefined when the account never connected YouTube', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ytAccessToken: null } as never)
    expect(await optionalAccessToken('u1')).toBeUndefined()
  })

  it('returns the token while it is still valid', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ytAccessToken: 'tok',
      ytTokenExpiry: new Date(Date.now() + 3_600_000),
    } as never)
    expect(await optionalAccessToken('u1')).toBe('tok')
  })

  it('returns undefined, and clears the tokens, when Google refuses the refresh', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ytAccessToken: 'old',
      ytRefreshToken: 'r',
      ytTokenExpiry: new Date(Date.now() - 1000),
    } as never)
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('invalid_grant'))

    expect(await optionalAccessToken('u1')).toBeUndefined()
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ytAccessToken: null, ytRefreshToken: null, ytTokenExpiry: null } }),
    )
  })

  it('lets any other error through', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ ytAccessToken: 'tok' } as never)
      .mockRejectedValueOnce(new Error('db down'))
    await expect(optionalAccessToken('u1')).rejects.toThrow('db down')
  })
})
