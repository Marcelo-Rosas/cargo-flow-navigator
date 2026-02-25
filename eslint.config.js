import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist', 'supabase/functions', 'src', 'supabase', 'data', 'docs'] },
  js.configs.recommended,
  {
    files: ['*.js', 'scripts/**/*.js', 'scripts/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  eslintConfigPrettier,
];
