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
      // These two react-hooks v7 rules flag long-standing patterns across the
      // existing components (function declarations used in an effect above
      // their definition, and setState called directly in an effect). They're
      // worth cleaning up, but as a deliberate refactor rather than a blocker
      // on every future lint run — kept visible as warnings until then.
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      // JSX-only identifiers read as unused to base ESLint; ignore intentional
      // throwaways too (e.g. destructuring off a field we don't need).
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
];
