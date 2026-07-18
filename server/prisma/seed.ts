import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@youcus.fr' },
    update: {},
    create: {
      email: 'demo@youcus.fr',
      displayName: 'Utilisateur démo',
      googleId: 'seed-google-id',
    },
  })
  console.log(`Seed terminé : utilisateur ${user.email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
