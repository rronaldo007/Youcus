import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1).optional(),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(8).default('dev-secret-change-me'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),
})

export const env = schema.parse(process.env)
export type Env = z.infer<typeof schema>
