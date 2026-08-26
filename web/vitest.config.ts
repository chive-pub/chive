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
      // Frontend coverage was measured by nobody: this config declared no
      // thresholds and CI ran the suite without `--coverage` at all, so the
      // stated 70% bar in CLAUDE.md was unenforced end to end and the real
      // figure had drifted to roughly 41% of lines.
      //
      // These numbers are set just under what the suite currently achieves, so
      // they act as a ratchet against further slippage rather than as the bar
      // the project actually wants. Raising them toward 70% is real test-writing
      // work; pretending the bar is already met by declaring it here would just
      // break every pull request on debt that predates the threshold.
      thresholds: {
        lines: 40,
        statements: 40,
        branches: 72,
        functions: 43,
      },
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
