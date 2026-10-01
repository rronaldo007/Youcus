import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { Readable } from 'node:stream'
import { env, isImageStorageConfigured } from '@/config/env'
import { HttpError } from '@/middleware/errorHandler'

/**
 * The object storage of the note images (YC-50): Sevalla object storage in production (S3 API,
 * Cloudflare R2 underneath), MinIO in docker compose. The bucket is private: files go through
 * the API, which checks their owner.
 */
let client: S3Client | null = null

function s3(): S3Client {
  if (!isImageStorageConfigured()) throw new HttpError(503, 'Les images ne sont pas configurées sur ce serveur')
  client ??= new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID as string, secretAccessKey: env.S3_SECRET_ACCESS_KEY as string },
  })
  return client
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3().send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }))
}

export async function getObject(key: string): Promise<{ body: Readable; contentType: string; length?: number }> {
  const out = await s3().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
  if (!out.Body) throw new HttpError(404, 'Image introuvable')
  return { body: out.Body as Readable, contentType: out.ContentType ?? 'application/octet-stream', length: out.ContentLength }
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
}
