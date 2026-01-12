import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Base path to react-pdf-highlighter-extended package
const pdfHighlighterPath = path.resolve(__dirname, 'node_modules/react-pdf-highlighter-extended');

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'out'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', '.next/', 'out/', 'tests/', '**/*.test.{ts,tsx}', '**/types/**'],
    },
    // Inline dependencies that have incomplete package.json exports
    server: {
      deps: {
        inline: ['react-pdf-highlighter-extended'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Fix for react-pdf-highlighter-extended which has incomplete package.json (no main/exports, only module)
      // Map CSS imports to actual file locations
      'react-pdf-highlighter-extended/dist/esm/style/PdfHighlighter.css': path.join(
        pdfHighlighterPath,
        'dist/esm/style/PdfHighlighter.css'
      ),
      'react-pdf-highlighter-extended/dist/esm/style/AreaHighlight.css': path.join(
        pdfHighlighterPath,
        'dist/esm/style/AreaHighlight.css'
      ),
      'react-pdf-highlighter-extended/dist/esm/style/TextHighlight.css': path.join(
        pdfHighlighterPath,
        'dist/esm/style/TextHighlight.css'
      ),
      'react-pdf-highlighter-extended/dist/esm/style/Highlight.css': path.join(
        pdfHighlighterPath,
        'dist/esm/style/Highlight.css'
      ),
      'react-pdf-highlighter-extended/dist/esm/style/MouseSelection.css': path.join(
        pdfHighlighterPath,
        'dist/esm/style/MouseSelection.css'
      ),
      // Point main module to ESM entry point
      'react-pdf-highlighter-extended': path.join(pdfHighlighterPath, 'dist/esm/index.js'),
    },
  },
});
