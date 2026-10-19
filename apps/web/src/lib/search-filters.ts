/** Shared by the filter panel, the sort control and the sneakers page. All filter state lives in the URL. */

/** Query-string keys the browse page understands (page 1 is always what you get when one changes). */
export const FILTER_KEYS = ['brand', 'store', 'color', 'minPrice', 'maxPrice', 'minStores', 'soldOut', 'signal'] as const;

export const SORT_OPTIONS = [
  { value: '', label: 'Most compared first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name_asc', label: 'Name: A to Z' },
  { value: 'name_desc', label: 'Name: Z to A' },
  { value: 'stores', label: 'Most stores, then cheapest' },
] as const;

/** Swatch colours for each colour family the API knows about (see apps/api catalog-filters.ts). */
export const COLOR_SWATCH: Record<string, { label: string; hex: string }> = {
  black: { label: 'Black', hex: '#111111' },
  white: { label: 'White', hex: '#FFFFFF' },
  grey: { label: 'Grey', hex: '#9CA3AF' },
  brown: { label: 'Brown', hex: '#7B5238' },
  beige: { label: 'Beige', hex: '#D9C7A3' },
  red: { label: 'Red', hex: '#D62F2F' },
  orange: { label: 'Orange', hex: '#F28C28' },
  yellow: { label: 'Yellow', hex: '#F2D13C' },
  green: { label: 'Green', hex: '#3E8E5A' },
  blue: { label: 'Blue', hex: '#2F63C8' },
  purple: { label: 'Purple', hex: '#7E57C2' },
  pink: { label: 'Pink', hex: '#F08CB4' },
};

export const PRICE_PRESETS = [
  { label: 'Under ₹5,000', min: '', max: '5000' },
  { label: '₹5,000 – 10,000', min: '5000', max: '10000' },
  { label: '₹10,000 – 15,000', min: '10000', max: '15000' },
  { label: '₹15,000 +', min: '15000', max: '' },
] as const;

export function splitList(value: string | null | undefined): string[] {
  return value ? value.split(',').map((v) => v.trim()).filter(Boolean) : [];
}

export function toggleInList(value: string | null | undefined, item: string): string {
  const list = splitList(value);
  return (list.includes(item) ? list.filter((v) => v !== item) : [...list, item]).join(',');
}
