import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.turbo/**',
      'coverage/**',
      '.next/**',
      'scripts/**',
      'src/lexicons/validators/**',
      'tests/performance/k6/**', // k6 uses its own JavaScript runtime
      'tests/e2e/**', // E2E tests have their own tsconfig
      'tests/integration/lexicons/codegen.test.ts', // Depends on excluded validators
      'docs/**', // Docusaurus has its own config
      'web/**', // Web app has its own eslint config
      '__mocks__/**', // Vitest mocks don't need type checking
    ],
  },

  // Base JavaScript recommended rules
  js.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Source code configuration
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
  },

  // Observability files - allow console.log for telemetry lifecycle messages
  {
    files: ['src/observability/**/*.ts'],
    rules: {
      'no-console': ['warn', { allow: ['log', 'info', 'warn', 'error'] }],
    },
  },

  // Test files configuration
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // Disable unbound-method for test files - vitest/jest mocks don't use this binding
      '@typescript-eslint/unbound-method': 'off',
      // Allow unsafe assignments in tests - vitest matchers (expect.objectContaining, etc.) return any
      '@typescript-eslint/no-unsafe-assignment': 'off',
      // Allow unsafe member access in tests - needed for accessing mock call arguments
      '@typescript-eslint/no-unsafe-member-access': 'off',
      // Allow unsafe calls in tests - vitest matchers return any typed functions
      '@typescript-eslint/no-unsafe-call': 'off',
      // Allow empty functions in tests - common for mock callbacks
      '@typescript-eslint/no-empty-function': 'off',
      // Allow non-null assertions after optional chaining in tests
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
  },

  // Config files configuration
  {
    files: ['*.config.ts', '*.config.js', 'vitest.*.config.ts', 'playwright.config.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.config.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
  },

  // Prettier (must be last to override other configs)
  prettierConfig
);
