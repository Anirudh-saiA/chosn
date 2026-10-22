export const COLUMNS = ['brand', 'model', 'colorway', 'style_code', 'size', 'retailer', 'price', 'shipping', 'url', 'in_stock', 'image_url', 'size_system', 'condition', 'delivery_time'];

const esc = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows) => [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
