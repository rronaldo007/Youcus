import { z } from 'zod'

/**
 * The page of a note (YC-45): its paper, its tint and whether the margin column is shown.
 * Stored per note, as names from fixed lists (the client gives each a light and a dark value).
 * Same lists as client/src/features/notes/notePage.ts.
 */
export const PAPERS = ['lignes', 'seyes', 'carreaux', 'points', 'uni'] as const
export const TINTS = ['creme', 'blanc', 'sepia', 'bleu', 'vert'] as const

const pageSchema = z
  .object({ paper: z.enum(PAPERS), tint: z.enum(TINTS), margin: z.boolean() })
  .strict()

export type NotePage = z.infer<typeof pageSchema>

/**
 * Reads the page sent with a note: `undefined` when absent (the stored page is kept), the
 * validated page, or a 400. A client that only sends `{ doc }` never erases the page.
 */
export function parseNotePage(input: unknown): { ok: true; page: NotePage | undefined } | { ok: false; message: string } {
  if (input === undefined) return { ok: true, page: undefined }
  const parsed = pageSchema.safeParse(input)
  return parsed.success ? { ok: true, page: parsed.data } : { ok: false, message: 'Page de note invalide' }
}
