import type { User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { GoogleProfile, GoogleTokens } from '@/lib/googleOAuth'

/**
 * Crée ou met à jour l'utilisateur à partir de son profil Google.
 * Première connexion → création du compte ; connexions suivantes → mise à jour du profil.
 * Si des jetons OAuth sont fournis, ils sont stockés (le refresh_token n'écrase pas l'existant s'il est absent).
 */
export function upsertGoogleUser(profile: GoogleProfile, tokens?: GoogleTokens): Promise<User> {
  const tokenData = tokens
    ? {
        ytAccessToken: tokens.accessToken,
        ytTokenExpiry: tokens.expiresAt,
        ...(tokens.refreshToken ? { ytRefreshToken: tokens.refreshToken } : {}),
      }
    : {}

  return prisma.user.upsert({
    where: { googleId: profile.googleId },
    create: {
      googleId: profile.googleId,
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      ...tokenData,
    },
    update: {
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      ...tokenData,
    },
  })
}
