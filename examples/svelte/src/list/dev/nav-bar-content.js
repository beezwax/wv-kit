const btn = document.createElement('button');
btn.type = 'button';
btn.className = 'btn btn-sm btn-outline-secondary';
btn.textContent = 'Clear filters';
btn.addEventListener('click', () => {
  // React's controlled inputs ignore direct `.value = ''` writes; they only
  // react to events fired through the native prototype setter. Going through
  // the setter works for every other framework too, so do it unconditionally.
  const inputSetter  = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,  'value').set;
  const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  for (const el of document.querySelectorAll('input[type="search"]')) {
    inputSetter.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  for (const el of document.querySelectorAll('select')) {
    selectSetter.call(el, '');
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
});
export default btn;
