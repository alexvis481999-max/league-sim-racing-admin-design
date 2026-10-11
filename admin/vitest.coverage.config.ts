import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage/admin-workflows',
      include: [
        'src/pages/events/create/eventCreateModel.ts',
        'src/pages/catalog/CatalogPage.tsx',
        'src/pages/skins/SkinsPage.tsx',
        'src/shared/ArchiveDropZone.tsx',
      ],
      thresholds: {
        lines: 30,
        branches: 20,
      },
    },
  },
});
