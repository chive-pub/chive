import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Plugin to mock react-pdf-highlighter-extended CSS imports
function mockPdfHighlighterCSS(): Plugin {
  return {
    name: 'mock-pdf-highlighter-css',
    enforce: 'pre',
    resolveId(id) {
      if (id.includes('react-pdf-highlighter-extended') && id.endsWith('.css')) {
        return path.resolve(__dirname, './__mocks__/empty-style.css');
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [react(), mockPdfHighlighterCSS()],
  css: {
    // Don't process CSS in tests
    modules: {
      localsConvention: 'camelCase',
    },
  },
  test: {
    css: true, // Enable CSS processing so mock aliases work
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['components/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', '.storybook'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.storybook/',
        '.next/',
        '**/*.stories.tsx',
        '**/*.d.ts',
        'tests/',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // Mock react-pdf-highlighter-extended which has SSR issues
      'react-pdf-highlighter-extended': path.resolve(
        __dirname,
        './__mocks__/react-pdf-highlighter-extended.tsx'
      ),
      'react-pdf-highlighter-extended/dist/esm/style/PdfHighlighter.css': path.resolve(
        __dirname,
        './__mocks__/empty-style.css'
      ),
      'react-pdf-highlighter-extended/dist/esm/style/AreaHighlight.css': path.resolve(
        __dirname,
        './__mocks__/empty-style.css'
      ),
      'react-pdf-highlighter-extended/dist/esm/style/TextHighlight.css': path.resolve(
        __dirname,
        './__mocks__/empty-style.css'
      ),
      'react-pdf-highlighter-extended/dist/esm/style/MouseSelection.css': path.resolve(
        __dirname,
        './__mocks__/empty-style.css'
      ),
    },
  },
});
