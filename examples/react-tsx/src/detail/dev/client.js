import filemakerScripts from '../../shared/filemaker-scripts.js';

const id = new URLSearchParams(window.location.search).get('id') ?? 'new';
filemakerScripts.requestProduct(id);
