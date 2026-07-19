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
})
