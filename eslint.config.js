import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default ts.config(
  {
    ignores: [
      'dist/',
      'coverage/',
      'test-results/',
      'playwright-report/',
      '.cache/',
      'packages/*/dist/',
      'apps/web/public/openscad/',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // `_name` marks an intentionally unused argument or binding.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: ts.parser } },
  },
  {
    // TypeScript already reports undefined names, including DOM types ESLint does not know.
    files: ['**/*.ts', '**/*.svelte'],
    rules: { 'no-undef': 'off' },
  },
  {
    // The geometry core keeps the Python port's style (untyped, variables declared up front and
    // assigned later); tighten file by file.
    files: ['packages/core/src/**/*.ts', 'tests/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off', 'prefer-const': 'off' },
  },
);
