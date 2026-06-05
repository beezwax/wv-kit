import { svelte } from '@sveltejs/vite-plugin-svelte';
import { mergeConfig } from 'vite';
import baseConfig from 'wv-kit/vite.config.js';

export default mergeConfig(baseConfig, { plugins: [svelte()] });
