/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Project GitHub Pages serves from /TaSkill/, so every asset URL
  // must be prefixed with the repo name or the deployed site 404s.
  base: '/TaSkill/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
