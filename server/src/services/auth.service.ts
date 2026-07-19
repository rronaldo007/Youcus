import type { User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { GoogleProfile } from '@/lib/googleOAuth'

/**
 * Crée ou met à jour l'utilisateur à partir de son profil Google.
 * Première connexion → création du compte ; connexions suivantes → mise à jour du profil.
 */
export function upsertGoogleUser(profile: GoogleProfile): Promise<User> {
  return prisma.user.upsert({
    where: { googleId: profile.googleId },
    create: {
      googleId: profile.googleId,
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
    update: {
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
  })
}
