import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '@/app'

describe('GET /api/health', () => {
  it('répond 200 avec le statut ok', async () => {
    const res = await request(createApp()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
