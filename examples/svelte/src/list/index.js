import { mount } from 'svelte';
import { onMount } from 'wv-kit';
import filemakerScripts from '../shared/filemaker-scripts.js';
import controlFunctions from './control-functions.js';
import App from './view.svelte';

Object.assign(window, controlFunctions);
filemakerScripts.requestProducts();

const container = document.createElement('div');
onMount(() => { mount(App, { target: container }); });
export default container;
