import './js-functions.js';
import { mount } from 'svelte';
import { onMount } from 'wv-kit';
import App from './view.svelte';

const container = document.createElement('div');
onMount(() => { mount(App, { target: container }); });
export default container;
