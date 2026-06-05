import wvKitConfig from 'wv-kit/eslint.config.js';

export default [
  ...wvKitConfig,
  {
    files: ['src/**/*.jsx'],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
];
