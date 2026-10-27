/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Tests never talk to the real cloud: the app's Supabase calls go to an in-memory fake (see src/test/fakeSupabase.ts).
    env: { VITE_SUPABASE_URL: 'https://fake.supabase.test', VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
