import { prisma } from '@/lib/prisma'
import { describeReport, runSameNameMerges } from '@/jobs/mergeSameName'

// One-off run (YC-105). A dry run unless --apply is given:
//   dev :  npm run playlists:merge-same-name [-- --apply]
//   prod : node dist/jobs/mergeSameName.cli.js [--apply]   (the image holds dist/, not src/)
const apply = process.argv.slice(2).includes('--apply')
const report = await runSameNameMerges({ apply })
for (const line of describeReport(report)) console.log(line)
await prisma.$disconnect()
process.exit(report.failed.length ? 1 : 0)
