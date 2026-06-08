import { mount } from 'svelte';
import { onMount } from 'wv-kit';
import controlFunctions from './control-functions.js';
import App from './view.svelte';

Object.assign(window, controlFunctions);

const container = document.createElement('div');
onMount(() => { mount(App, { target: container }); });
export default container;
