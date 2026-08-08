import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // On mesure le code metier et les middlewares, pas la plomberie generee
      // ni les points d'entree qui ne contiennent que du cablage.
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/types/**', 'src/**/*.d.ts'],
    },
  },
})
