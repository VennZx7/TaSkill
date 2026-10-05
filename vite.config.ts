/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Project GitHub Pages serves from /TaSkill/, so every asset URL
  // must be prefixed with the repo name or the deployed site 404s.
  base: '/TaSkill/',
  // GitHub Pages "Deploy from a branch" only serves the branch root
  // or a /docs folder, so the build output goes to docs/.
  build: { outDir: 'docs' },
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
