import data from './data.json';

const btn = document.createElement('button');
btn.type = 'button';
btn.className = 'btn btn-sm btn-outline-secondary';
btn.textContent = 'Reload';
btn.addEventListener('click', () => window.loadData(JSON.stringify(data)));
export default btn;
