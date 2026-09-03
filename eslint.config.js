import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'project_documents', 'docs'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Strict rule: ban "any" everywhere
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // Engine purity & determinism boundary rules:
  // Must NOT import React, touch document/window/storage/performance,
  // or read ambient time (Date.now, new Date(), performance.now) or entropy (Math.random)
  {
    files: ['src/engine/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'Engine must be pure game logic and cannot import react.',
            },
            {
              name: 'react-dom',
              message: 'Engine must be pure game logic and cannot import react-dom.',
            },
            {
              name: 'react-dom/client',
              message: 'Engine must be pure game logic and cannot import react-dom/client.',
            },
            {
              name: 'react-dom/server',
              message: 'Engine must be pure game logic and cannot import react-dom/server.',
            },
          ],
          patterns: [
            {
              group: ['react/*', 'react-dom/*'],
              message: 'Engine must not import React packages.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'Engine must be pure game logic and cannot reference window.',
        },
        {
          name: 'document',
          message: 'Engine must be pure game logic and cannot reference document.',
        },
        {
          name: 'localStorage',
          message: 'Engine must be pure game logic and cannot reference localStorage.',
        },
        {
          name: 'sessionStorage',
          message: 'Engine must be pure game logic and cannot reference sessionStorage.',
        },
        {
          name: 'performance',
          message: 'Engine must be pure game logic and cannot reference performance.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message: 'Engine must not call Date.now(). Timestamps must be passed in as parameters.',
        },
        {
          object: 'Math',
          property: 'random',
          message: 'Engine must not call Math.random(). Randomness must come from an injected seeded RNG.',
        },
        {
          object: 'performance',
          property: 'now',
          message: 'Engine must not call performance.now(). Timestamps must be passed in as parameters.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'Engine must not instantiate Date. Timestamps must be passed in as parameters.',
        },
      ],
    },
  }
);
