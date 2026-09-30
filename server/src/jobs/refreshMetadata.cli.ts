import { prisma } from '@/lib/prisma'
import { isYouTubeConfigured } from '@/config/env'
import { runMetadataRefresh } from '@/jobs/refreshMetadata'

// One-off run: npm run metadata:refresh [-- <max videos>]
if (!isYouTubeConfigured()) {
  console.error('YOUTUBE_API_KEY manquante : rien à faire.')
  process.exit(1)
}
const max = process.argv[2] ? Number(process.argv[2]) : undefined
const report = await runMetadataRefresh(max)
console.log(JSON.stringify(report))
await prisma.$disconnect()
process.exit(report ? 0 : 1)
