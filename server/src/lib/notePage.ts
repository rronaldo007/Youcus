import { z } from 'zod'
import { FONTS } from '@/lib/noteDoc'

/**
 * The page of a note (YC-45): its paper, its tint, whether the margin column is shown and, since
 * YC-56, whether the timestamped markers are (hiding them deletes none).
 * Stored per note, as names from fixed lists (the client gives each a light and a dark value).
 * Same lists as client/src/features/notes/notePage.ts.
 */
export const PAPERS = ['lignes', 'seyes', 'carreaux', 'points', 'uni'] as const
export const TINTS = ['creme', 'blanc', 'sepia', 'bleu', 'vert'] as const

const pageSchema = z
  // `timestamps` is optional: pages saved before YC-56 do not have it, and mean « shown ».
  // `font` and `size` (YC-48) are the base of the note's text; absent = Hanken Grotesk 16.
  .object({
    paper: z.enum(PAPERS),
    tint: z.enum(TINTS),
    margin: z.boolean(),
    timestamps: z.boolean().optional(),
    font: z.enum(FONTS).optional(),
    // The sizes of SIZES (noteDoc.ts), spelled as literals for zod.
    size: z.union([z.literal(12), z.literal(14), z.literal(16), z.literal(18), z.literal(20), z.literal(24), z.literal(28), z.literal(32)]).optional(),
  })
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

/**
 * The starting settings of every new note (YC-48), from Réglages › Notes: the whole page, every
 * key given. Copied into a note when it is created; changing them never touches an existing note.
 */
const preferencesSchema = pageSchema.required()
export type NotePreferences = z.infer<typeof preferencesSchema>

/** What a new note gets when nothing was set: lined cream paper, margin and timestamps, Hanken 16. */
export const DEFAULT_PREFERENCES: NotePreferences = {
  paper: 'lignes',
  tint: 'creme',
  margin: true,
  timestamps: true,
  font: 'hanken',
  size: 16,
}

/** Reads the preferences sent from the settings: all of them, or a 400. */
export function parseNotePreferences(input: unknown): { ok: true; preferences: NotePreferences } | { ok: false; message: string } {
  const parsed = preferencesSchema.safeParse(input)
  return parsed.success ? { ok: true, preferences: parsed.data } : { ok: false, message: 'Réglages de note invalides' }
}

/** The stored preferences of an account, the defaults where none (or an unreadable value) is stored. */
export function readNotePreferences(stored: unknown): NotePreferences {
  const parsed = preferencesSchema.safeParse(stored)
  return parsed.success ? parsed.data : DEFAULT_PREFERENCES
}
