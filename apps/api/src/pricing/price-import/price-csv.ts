/**
 * CSV price import: the pure half (no database). Turns a pasted/uploaded
 * spreadsheet into validated rows, or into a list of line-numbered errors
 * the person can fix and re-upload. Nothing here touches Postgres, so the
 * whole contract is unit-testable (price-csv.spec.ts).
 *
 * One row = one price for one size of one sneaker at one store:
 *
 *   brand, model, colorway, style_code, size, retailer, price, shipping, url, in_stock, image_url, size_system, condition
 *
 * Required: brand, model, colorway, style_code, size, retailer, price, url.
 * Optional: shipping (blank = 0), in_stock (blank = yes), image_url,
 * size_system (blank = us), condition (blank = new).
 */

export const MAX_ROWS = 2000;

export const CSV_COLUMNS = [
  'brand',
  'model',
  'colorway',
  'style_code',
  'size',
  'retailer',
  'price',
  'shipping',
  'url',
  'in_stock',
  'image_url',
  'size_system',
  'condition',
  'gallery_urls',
] as const;

const REQUIRED = ['brand', 'model', 'colorway', 'style_code', 'size', 'retailer', 'price', 'url'] as const;

export type SizeSystem = 'us' | 'uk' | 'eu' | 'cm';

export interface PriceRow {
  /** 1-based line number in the file (the header is line 1) */
  line: number;
  brand: string;
  model: string;
  colorway: string;
  styleCode: string;
  size: number;
  sizeSystem: SizeSystem;
  retailer: string;
  price: number;
  shipping: number;
  url: string;
  inStock: boolean;
  imageUrl: string | null;
  /** Other photos of the same pair (optional column gallery_urls: https links separated by |). */
  galleryUrls: string[];
  condition: 'new' | 'used';
}

export interface RowError {
  line: number;
  message: string;
}

export interface ParseResult {
  rows: PriceRow[];
  errors: RowError[];
}

/** A tiny RFC 4180 reader: quoted fields, escaped quotes (""), commas and newlines inside quotes, CRLF, UTF-8 BOM. */
export function readCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      out.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    out.push(row);
  }
  return out;
}

const norm = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, '_');

/** Header aliases people commonly use when they build a sheet by hand. */
const ALIASES: Record<string, (typeof CSV_COLUMNS)[number]> = {
  stylecode: 'style_code',
  style: 'style_code',
  sku: 'style_code',
  store: 'retailer',
  shop: 'retailer',
  seller: 'retailer',
  link: 'url',
  listing_url: 'url',
  product_url: 'url',
  stock: 'in_stock',
  instock: 'in_stock',
  shipping_cost: 'shipping',
  delivery: 'shipping',
  image: 'image_url',
  imageurl: 'image_url',
  colourway: 'colorway',
  colour: 'colorway',
  color: 'colorway',
  size_type: 'size_system',
};

function headerIndex(header: string[]): Map<(typeof CSV_COLUMNS)[number], number> {
  const map = new Map<(typeof CSV_COLUMNS)[number], number>();
  header.forEach((raw, i) => {
    const key = norm(raw);
    const col = (CSV_COLUMNS as readonly string[]).includes(key) ? (key as (typeof CSV_COLUMNS)[number]) : ALIASES[key];
    if (col && !map.has(col)) map.set(col, i);
  });
  return map;
}

/** "₹9,295", "Rs. 9295.00", "9 295" -> 9295 */
export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[₹\s,]|rs\.?|inr/gi, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}

function parseBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (v === '') return true;
  if (['yes', 'y', 'true', '1', 'in stock', 'instock'].includes(v)) return true;
  if (['no', 'n', 'false', '0', 'out of stock', 'oos', 'out'].includes(v)) return false;
  return null;
}

export function parsePriceCsv(text: string): ParseResult {
  const table = readCsv(text).filter((r) => r.some((cell) => cell.trim() !== ''));
  if (table.length === 0) return { rows: [], errors: [{ line: 1, message: 'The file is empty.' }] };

  const header = table[0]!;
  const idx = headerIndex(header);
  const missing = REQUIRED.filter((c) => !idx.has(c));
  if (missing.length > 0) {
    return { rows: [], errors: [{ line: 1, message: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Download the template to see the expected headers.` }] };
  }

  const body = table.slice(1);
  if (body.length === 0) return { rows: [], errors: [{ line: 2, message: 'There are no price rows under the header.' }] };
  if (body.length > MAX_ROWS) {
    return { rows: [], errors: [{ line: 1, message: `Too many rows (${body.length}). Upload at most ${MAX_ROWS} at a time.` }] };
  }

  const rows: PriceRow[] = [];
  const errors: RowError[] = [];
  const seen = new Map<string, number>();
  const cell = (r: string[], col: (typeof CSV_COLUMNS)[number]) => (idx.has(col) ? (r[idx.get(col)!] ?? '').trim() : '');

  body.forEach((r, n) => {
    const line = n + 2; // header is line 1
    const bad = (message: string) => errors.push({ line, message });

    const brand = cell(r, 'brand');
    const model = cell(r, 'model');
    const colorway = cell(r, 'colorway');
    const styleCode = cell(r, 'style_code').toUpperCase().replace(/\s+/g, '');
    const retailer = cell(r, 'retailer');
    const urlRaw = cell(r, 'url');

    for (const [label, value] of [['brand', brand], ['model', model], ['colorway', colorway], ['style_code', styleCode], ['retailer', retailer]] as const) {
      if (!value) return bad(`"${label}" is empty.`);
    }

    const size = Number(cell(r, 'size'));
    if (!Number.isFinite(size) || size < 1 || size > 60 || (size * 2) % 1 !== 0) return bad(`size "${cell(r, 'size')}" isn't valid (use a number such as 9 or 9.5).`);

    const sizeSystemRaw = cell(r, 'size_system').toLowerCase() || 'us';
    if (!['us', 'uk', 'eu', 'cm'].includes(sizeSystemRaw)) return bad(`size_system "${sizeSystemRaw}" must be us, uk, eu or cm.`);

    const price = parseMoney(cell(r, 'price'));
    if (price === null || price <= 0) return bad(`price "${cell(r, 'price')}" isn't a valid amount (use digits like 9295).`);

    const shippingRaw = cell(r, 'shipping');
    const shipping = shippingRaw === '' ? 0 : parseMoney(shippingRaw);
    if (shipping === null) return bad(`shipping "${shippingRaw}" isn't a valid amount (use 0 for free shipping).`);

    let url: URL;
    try {
      url = new URL(urlRaw);
    } catch {
      return bad(`url "${urlRaw}" isn't a valid link.`);
    }
    if (url.protocol !== 'https:') return bad('url must start with https://');

    const inStock = parseBool(cell(r, 'in_stock'));
    if (inStock === null) return bad(`in_stock "${cell(r, 'in_stock')}" must be yes or no.`);

    const conditionRaw = cell(r, 'condition').toLowerCase() || 'new';
    if (conditionRaw !== 'new' && conditionRaw !== 'used') return bad(`condition "${conditionRaw}" must be new or used.`);

    const imageRaw = cell(r, 'image_url');
    let imageUrl: string | null = null;
    if (imageRaw) {
      try {
        const u = new URL(imageRaw);
        if (u.protocol !== 'https:') return bad('image_url must start with https://');
        imageUrl = u.toString();
      } catch {
        return bad(`image_url "${imageRaw}" isn't a valid link.`);
      }
    }

    // Optional extra photos: bad links are skipped quietly, they are a nice-to-have and never block a price.
    const galleryUrls = cell(r, 'gallery_urls')
      .split('|')
      .map((x) => x.trim())
      .filter((x) => {
        try {
          return new URL(x).protocol === 'https:';
        } catch {
          return false;
        }
      })
      .slice(0, 6);

    // The same store can't have two prices for the same shoe and size in one upload.
    const key = `${retailer.toLowerCase()}|${styleCode}|${sizeSystemRaw}|${size}`;
    const firstLine = seen.get(key);
    if (firstLine !== undefined) return bad(`duplicate of line ${firstLine} (same store, style code and size).`);
    seen.set(key, line);

    rows.push({
      line,
      brand,
      model,
      colorway,
      styleCode,
      size,
      sizeSystem: sizeSystemRaw as SizeSystem,
      retailer,
      price,
      shipping,
      url: url.toString(),
      inStock,
      imageUrl,
      galleryUrls,
      condition: conditionRaw,
    });
  });

  return { rows, errors };
}

/** The downloadable template: header + two example rows people can overwrite. */
export function csvTemplate(): string {
  const header = CSV_COLUMNS.join(',');
  const examples = [
    ['Nike', 'Dunk Low', 'Sail / Team Red', 'DH9765-100', '9', 'Superkicks', '9295', '0', 'https://www.superkicks.in/products/example-dunk-low', 'yes', '', 'us', 'new'],
    ['adidas', 'Samba OG', 'White / Black / Gum', 'IE3437', '9', 'VegNonVeg', '10499', '99', 'https://www.vegnonveg.com/products/example-samba', 'yes', '', 'us', 'new'],
  ];
  return [header, ...examples.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))].join('\n') + '\n';
}

/** "Foot Locker India" -> "foot-locker-india" */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
