import kensington from 'kensington-eslint-plugin';
import wvKitConfig from 'wv-kit/eslint.config.js';

export default [
  // .d.ts files are TypeScript syntax — exclude from this project's lint since
  // it has no TS parser configured. Type-checking happens via tsc against
  // tsconfig.json instead.
  { ignores: ['**/*.d.ts'] },
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
