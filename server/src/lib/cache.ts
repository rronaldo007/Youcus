import Redis from 'ioredis'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'

/**
 * Cache Redis (NoSQL clé-valeur) pour les métadonnées de l'API YouTube.
 *
 * Principe directeur : le cache est une OPTIMISATION, jamais une dépendance.
 * Si Redis est absent, éteint ou en erreur, l'application continue de
 * fonctionner en interrogeant directement l'API YouTube. Toutes les fonctions
 * de ce module échouent en silence (journalisé) plutôt que de propager.
 */

let client: Redis | null = null
let disabled = false

/** Connexion paresseuse : rien n'est ouvert tant qu'aucun cache n'est demandé. */
function getClient(): Redis | null {
  if (disabled) return null
  if (client) return client
  if (!env.REDIS_URL) {
    disabled = true
    logger.info('Cache Redis désactivé (REDIS_URL absent)')
    return null
  }

  client = new Redis(env.REDIS_URL, {
    // Une commande ne doit jamais faire attendre une requête HTTP :
    // si Redis ne répond pas, on abandonne et on passe à la source.
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    lazyConnect: false,
    enableOfflineQueue: false,
  })

  client.on('error', (err) => {
    logger.warn({ err: err.message }, 'Redis indisponible, lecture directe depuis la source')
  })

  return client
}

/** Ferme la connexion (arrêt du serveur, fin des tests). */
export async function closeCache(): Promise<void> {
  if (client) {
    await client.quit().catch(() => undefined)
    client = null
  }
  disabled = false
}

/** Clé de cache d'une playlist YouTube. Le préfixe permet de purger par motif. */
export function playlistKey(youtubeId: string): string {
  return `yt:playlist:${youtubeId}`
}

/** Durée de vie par défaut : 6 h. Un titre de playlist change rarement dans la journée. */
export const DEFAULT_TTL_SECONDS = 6 * 60 * 60

/**
 * Cache-aside (lazy loading) : on lit le cache, et seulement en cas d'absence
 * on appelle la source, dont le résultat est écrit avec une durée de vie.
 *
 * Toute erreur Redis — connexion, sérialisation, JSON corrompu — est absorbée :
 * on retombe sur `loader`, qui est la vérité.
 */
export async function cacheAside<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<T> {
  const redis = getClient()

  if (redis) {
    try {
      const hit = await redis.get(key)
      if (hit !== null) {
        logger.debug({ key }, 'Cache hit')
        return JSON.parse(hit) as T
      }
    } catch (err) {
      logger.warn({ key, err }, 'Lecture du cache impossible')
    }
  }

  const value = await loader()

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    } catch (err) {
      logger.warn({ key, err }, 'Écriture du cache impossible')
    }
  }

  return value
}

/** Invalide une clé. Appelé au rafraîchissement manuel : l'utilisateur veut du frais. */
export async function invalidate(key: string): Promise<void> {
  const redis = getClient()
  if (!redis) return
  try {
    await redis.del(key)
  } catch (err) {
    logger.warn({ key, err }, 'Invalidation du cache impossible')
  }
}
