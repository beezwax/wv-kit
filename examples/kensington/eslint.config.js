import kensington from 'kensington-eslint-plugin';
import wvKitConfig from 'wv-kit/eslint.config.js';

export default [
  ...wvKitConfig,
  kensington.configs.recommended,
  kensington.configs.style,
  {
    files: ['src/**/*.js'],
    rules: {
      'max-len': ['warn', { code: 120, ignoreComments: true }],
    },
  },
];
