import { API_URL, apiFetch } from '@/lib/api'

/** 10 Mo, the server's ceiling too (Figma menu « Insérer » 63:2013). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
export const ACCEPTED_IMAGES = ACCEPTED.join(',')

export interface UploadedImage {
  id: string
  width: number
  height: number
  name: string | null
}

/** Where the editor reads an image: the API, which serves it to its owner only (YC-50). */
export const noteImageUrl = (id: string) => `${API_URL}/note-images/${encodeURIComponent(id)}`

/** Why a file cannot go into a note, said before it is sent; null when it can. */
export function imageProblem(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) return `« ${file.name} » n'est pas une image JPEG, PNG, WebP, GIF ou AVIF.`
  if (file.size > MAX_IMAGE_BYTES) return `« ${file.name} » dépasse 10 Mo.`
  return null
}

/** Sends one image as the body itself; the server re-encodes it and answers its id. */
export function uploadNoteImage(file: File): Promise<UploadedImage> {
  return apiFetch<UploadedImage>('/note-images', {
    method: 'POST',
    headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name.slice(0, 200)) },
    body: file,
  })
}
