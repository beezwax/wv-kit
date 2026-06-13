import data from '../../list/dev/data.json';
import { jsFunctions } from '../js-functions.js';
import { blankProduct } from '../../../fm/schema.js';

const wrapper = document.createElement('div');
wrapper.className = 'd-flex align-items-center gap-2';

const label = document.createElement('label');
label.className = 'form-label mb-0 small fw-medium';
label.textContent = 'Load:';

const select = document.createElement('select');
select.className = 'form-select form-select-sm w-auto';
[{ value: '', text: 'Pick a product…' }, { value: 'new', text: '＋ New product' }].forEach(({ value, text }) => {
  const opt = document.createElement('option');
  opt.value = value; opt.textContent = text;
  select.appendChild(opt);
});
data.forEach(p => {
  const opt = document.createElement('option');
  opt.value = p.id; opt.textContent = p.name;
  select.appendChild(opt);
});
select.addEventListener('change', e => {
  const id = e.target.value;
  if (!id) return;
  const product = id === 'new' ? blankProduct : data.find(p => p.id === id);
  if (product) jsFunctions.loadDetail(JSON.stringify(product));
  e.target.value = '';
});

wrapper.append(label, select);
export default wrapper;

