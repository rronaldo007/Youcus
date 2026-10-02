import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { GoogleProfile } from '@/lib/googleOAuth'
import { upsertGoogleUser } from '@/services/auth.service'

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { upsert: vi.fn() } },
}))

describe('upsertGoogleUser', () => {
  beforeEach(() => vi.clearAllMocks())

  const profile: GoogleProfile = {
    googleId: 'g-123',
    email: 'alice@example.com',
    displayName: 'Alice',
    avatarUrl: 'https://img/alice.png',
  }

  it('upsert sur googleId : crée à la 1re connexion, met à jour ensuite', async () => {
    const fakeUser = {
      id: 'u1',
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      googleId: profile.googleId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User
    vi.mocked(prisma.user.upsert).mockResolvedValue(fakeUser)

    const user = await upsertGoogleUser(profile)

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { googleId: 'g-123' },
      create: {
        googleId: 'g-123',
        email: 'alice@example.com',
        displayName: 'Alice',
        avatarUrl: 'https://img/alice.png',
      },
      update: {
        email: 'alice@example.com',
        displayName: 'Alice',
        avatarUrl: 'https://img/alice.png',
      },
    })
    expect(user).toBe(fakeUser)
  })

  it('reconnected with YouTube: the tokens are kept and the expiry forgotten (YC-84)', async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue({} as User)
    const expiresAt = new Date('2026-10-03T10:00:00Z')
    await upsertGoogleUser(profile, { accessToken: 'at', refreshToken: 'rt', expiresAt })
    const args = vi.mocked(prisma.user.upsert).mock.calls[0][0]
    expect(args.update).toMatchObject({ ytAccessToken: 'at', ytRefreshToken: 'rt', ytTokenExpiry: expiresAt, ytExpiredAt: null })
  })

  it('a sign-in without YouTube touches neither the tokens nor the expiry', async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue({} as User)
    await upsertGoogleUser(profile)
    expect(vi.mocked(prisma.user.upsert).mock.calls[0][0].update).not.toHaveProperty('ytExpiredAt')
  })
})

