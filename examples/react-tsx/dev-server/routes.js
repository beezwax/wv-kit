import fs from 'node:fs';

import express from 'express';

const router = express.Router();
const DATA = new URL('./data/products.json', import.meta.url).pathname;

// Inspect current product data without opening the viewer
router.get('/api/products', (req, res) => {
  res.json(JSON.parse(fs.readFileSync(DATA, 'utf-8')));
});

export default router;
