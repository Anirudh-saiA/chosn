import { describe, expect, it } from 'vitest';
import { csvTemplate, parseMoney, parsePriceCsv, readCsv, slugify } from './price-csv';

const HEADER = 'brand,model,colorway,style_code,size,retailer,price,shipping,url,in_stock';
const OK = 'Nike,Dunk Low,Sail / Team Red,dh9765-100,9,Superkicks,"₹9,295",0,https://example.com/p/1,yes';

describe('readCsv', () => {
  it('handles quotes, commas inside quotes, escaped quotes, CRLF and a BOM', () => {
    const rows = readCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n');
    expect(rows).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
  });
});

describe('parseMoney', () => {
  it('accepts rupee signs, commas and Rs prefixes', () => {
    expect(parseMoney('₹9,295')).toBe(9295);
    expect(parseMoney('Rs. 9295.50')).toBe(9295.5);
    expect(parseMoney('  1 299 ')).toBe(1299);
  });
  it('rejects text and negatives', () => {
    expect(parseMoney('free')).toBeNull();
    expect(parseMoney('-5')).toBeNull();
  });
});

describe('parsePriceCsv', () => {
  it('parses a valid row and normalises the style code', () => {
    const { rows, errors } = parsePriceCsv(`${HEADER}\n${OK}\n`);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ styleCode: 'DH9765-100', size: 9, sizeSystem: 'us', price: 9295, shipping: 0, inStock: true, condition: 'new', retailer: 'Superkicks' });
  });

  it('defaults shipping, stock, size system and condition when the optional columns are blank', () => {
    const { rows } = parsePriceCsv(`brand,model,colorway,style_code,size,retailer,price,url\nNike,Dunk,Red,A1,9,Shop,100,https://x.com/p\n`);
    expect(rows[0]).toMatchObject({ shipping: 0, inStock: true, sizeSystem: 'us', condition: 'new', imageUrl: null });
  });

  it('accepts common header aliases (store, link, sku)', () => {
    const { rows, errors } = parsePriceCsv('brand,model,colourway,sku,size,store,price,link\nNike,Dunk,Red,A1,9,Shop,100,https://x.com/p\n');
    expect(errors).toEqual([]);
    expect(rows[0]?.retailer).toBe('Shop');
  });

  it('reports every bad row with its line number and keeps the good ones', () => {
    const csv = [HEADER, OK, 'Nike,Dunk,Red,A1,abc,Shop,100,0,https://x.com/p,yes', 'Nike,Dunk,Red,A2,9,Shop,free,0,https://x.com/p,yes', 'Nike,Dunk,Red,A3,9,Shop,100,0,http://x.com/p,yes'].join('\n');
    const { rows, errors } = parsePriceCsv(csv);
    expect(rows).toHaveLength(1);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5]);
    expect(errors[0]?.message).toMatch(/size/);
    expect(errors[1]?.message).toMatch(/price/);
    expect(errors[2]?.message).toMatch(/https/);
  });

  it('flags a duplicate store + style code + size in one file', () => {
    const { rows, errors } = parsePriceCsv(`${HEADER}\n${OK}\n${OK}\n`);
    expect(rows).toHaveLength(1);
    expect(errors).toEqual([{ line: 3, message: 'duplicate of line 2 (same store, style code and size).' }]);
  });

  it('tells you which columns are missing', () => {
    const { rows, errors } = parsePriceCsv('brand,model\nNike,Dunk\n');
    expect(rows).toEqual([]);
    expect(errors[0]?.message).toMatch(/Missing columns: colorway, style_code, size, retailer, price, url/);
  });

  it('rejects an empty file and a header-only file', () => {
    expect(parsePriceCsv('').errors[0]?.message).toMatch(/empty/);
    expect(parsePriceCsv(`${HEADER}\n`).errors[0]?.message).toMatch(/no price rows/);
  });

  it('accepts its own template', () => {
    const { rows, errors } = parsePriceCsv(csvTemplate());
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
  });
});

describe('slugify', () => {
  it('makes store names into slugs', () => {
    expect(slugify('Foot Locker India')).toBe('foot-locker-india');
    expect(slugify('END. Clothing')).toBe('end-clothing');
    expect(slugify('Crepdog Crew & Co')).toBe('crepdog-crew-and-co');
  });
});
