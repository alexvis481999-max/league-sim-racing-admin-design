import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const rootEnvDir = fileURLToPath(new URL('..', import.meta.url));

function portFromUrl(url: string | undefined, fallback: number): number {
  if (!url) return fallback;

  const port = Number(new URL(url).port);
  return Number.isInteger(port) && port > 0 ? port : fallback;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootEnvDir, '');

  return {
    plugins: [react()],
    // Shared event views must use the admin renderer and theme, not a second React/MUI instance.
    resolve: { dedupe: ['react', 'react-dom', '@mui/material', '@mui/system', '@emotion/react', '@emotion/styled'] },
    build: {
      chunkSizeWarningLimit: 1_000,
      rollupOptions: {
        output: { manualChunks: vendorChunk },
      },
    },
    define: {
      'import.meta.env.VITE_SITE_URL': JSON.stringify(
        String(env.VITE_SITE_URL || env.SITE_URL || 'http://localhost:5174').replace(/\/$/, ''),
      ),
    },
    server: {
      port: portFromUrl(env.ADMIN_PANEL_URL, 5176),
    },
  };
});

function vendorChunk(id: string): string | undefined {
  return id.includes('node_modules') ? 'vendor' : undefined;
}
