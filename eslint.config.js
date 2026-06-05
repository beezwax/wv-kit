import wvKit from './lib/eslint.js';

export default [
  { ignores: ['src/shared/installed/**'] },
  {
    files: ['src/**/*.js', 'src/**/*.ts', 'src/**/*.tsx', 'src/**/*.jsx'],
    ...wvKit.configs.recommended,
  },
  {
    files: ['src/**/dev/**'],
    rules: { 'wv-kit/no-window-location': 'off' },
  },
];
