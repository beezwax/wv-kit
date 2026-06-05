const btn = document.createElement('button');
btn.type = 'button';
btn.className = 'btn btn-sm btn-outline-secondary';
btn.textContent = 'Log Product';
btn.addEventListener('click', () => {
  const id = new URLSearchParams(window.location.search).get('id');
  fetch('/api/products')
    .then(r => r.json())
    .then(data => console.log('Current product:', data.find(p => p.id === id)));
});
export default btn;
