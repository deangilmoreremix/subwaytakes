import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Build outputs and tooling artifacts are not lint targets.
  // Source dirs stay in scope: src/, remotion/src/, supabase/functions/,
  // render-worker/src/, thumbnail-service/src/.
  {
    ignores: [
      'dist',
      '**/dist',
      'render-worker/dist',
      'thumbnail-service/dist',
      'coverage',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
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
      // Unused placeholders are intentional in several callbacks/options bags.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  // Node services (render worker, thumbnail service) use process/console/etc.
  {
    files: [
      'render-worker/src/**/*.{ts,tsx}',
      'thumbnail-service/src/**/*.{ts,tsx}',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  // Deno edge functions use the Deno global (browser globals from the base
  // config still apply where relevant).
  {
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        Deno: 'readonly',
      },
    },
  }
);
