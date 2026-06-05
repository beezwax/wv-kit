import solid from 'vite-plugin-solid';
import { mergeConfig } from 'vite';
import baseConfig from 'wv-kit/vite.config.js';

export default mergeConfig(baseConfig, { plugins: [solid()] });
