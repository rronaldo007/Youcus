import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.SEED_USER_EMAIL ?? 'demo@youcus.fr'
  const displayName = process.env.SEED_USER_NAME ?? 'Utilisateur démo'
  const googleId = process.env.SEED_USER_GOOGLE_ID ?? 'seed-google-id'

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, displayName, googleId },
  })
  console.log(`Seed terminé : utilisateur ${user.email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
