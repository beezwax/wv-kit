const btn = document.createElement('button');
btn.type = 'button';
btn.className = 'btn btn-sm btn-outline-secondary';
btn.textContent = 'Log Products';
btn.addEventListener('click', () => {
  fetch('/api/products').then(r => r.json()).then(data => {
    console.table(data.map(({ id, name, price, stock, status }) => ({ id, name, price, stock, status })));
  });
});
export default btn;
