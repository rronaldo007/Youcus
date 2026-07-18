import { PrismaClient } from '@prisma/client'

// Instance unique de Prisma (evite les connexions multiples en dev/hot-reload).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
