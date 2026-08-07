import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...(reactHooks.configs?.recommended?.rules ?? {}),
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Every remaining hit is setLoading(true/false) inside an async fetch
      // that an effect kicks off — the ordinary "load data on mount" pattern.
      // Satisfying this rule means moving data loading to Suspense or a query
      // library, which is a deliberate architectural change, not a lint fix.
      // Off rather than 'warn' so the warning list stays meaningful.
      'react-hooks/set-state-in-effect': 'off',
      // JSX-only identifiers read as unused to base ESLint; ignore intentional
      // throwaways too (e.g. destructuring off a field we don't need).
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
];
