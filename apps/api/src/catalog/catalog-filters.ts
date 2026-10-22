/**
 * Colour families for the catalog filter. A retailer's colourway is free text ("WHITE/LIGHT THISTLE-WHITE",
 * "Sail / Team Red"), so each family is a list of words; a shoe belongs to a family when its colourway
 * contains any of them as a whole word. A white-and-black shoe therefore shows under both White and Black.
 */
export const COLOR_FAMILIES: Record<string, string[]> = {
  black: ['black', 'noir', 'onyx', 'jet', 'obsidian'],
  white: ['white', 'sail', 'ivory', 'cream', 'coconut milk', 'summit', 'bone', 'pearl', 'phantom', 'chalk'],
  grey: ['grey', 'gray', 'silver', 'smoke', 'slate', 'charcoal', 'graphite', 'concrete', 'cement', 'fog', 'iron', 'platinum'],
  brown: ['brown', 'mocha', 'chocolate', 'cacao', 'espresso', 'coffee', 'russet', 'baroque', 'cinnamon', 'bronze'],
  beige: ['beige', 'sand', 'tan', 'khaki', 'oat', 'oatmeal', 'stone', 'taupe', 'camel', 'wheat', 'linen', 'birch', 'natural', 'gum'],
  red: ['red', 'crimson', 'burgundy', 'maroon', 'scarlet', 'infrared', 'cherry', 'bred', 'wine', 'cardinal'],
  orange: ['orange', 'amber', 'rust', 'coral', 'ember', 'sunset'],
  yellow: ['yellow', 'gold', 'lemon', 'citrus', 'mustard', 'curry', 'butter', 'lime'],
  green: ['green', 'olive', 'sage', 'mint', 'volt', 'spruce', 'forest', 'emerald', 'teal', 'jade', 'moss', 'fir'],
  blue: ['blue', 'navy', 'royal', 'indigo', 'denim', 'cobalt', 'sky', 'aqua', 'marine', 'midnight'],
  purple: ['purple', 'violet', 'lilac', 'lavender', 'plum', 'mauve', 'thistle', 'grape', 'orchid'],
  pink: ['pink', 'rose', 'blush', 'magenta', 'fuchsia', 'rosewood', 'salmon'],
};

/** Postgres regex (`~`) matching any of a family's words as whole words; null for an unknown family. */
export function colorRegex(family: string): string | null {
  const words = COLOR_FAMILIES[family];
  if (!words) return null;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return `\\m(${escaped.join('|')})\\M`;
}

/** "nike,adidas" -> ["nike", "adidas"]; trims, drops blanks and repeats, caps the list. */
export function parseList(value: string | undefined, max = 12): string[] {
  if (!value) return [];
  return [...new Set(value.split(',').map((v) => v.trim()).filter(Boolean))].slice(0, max);
}

/**
 * Turns how people actually type a sneaker into how the catalog spells it, so "Nike airforce", "af1",
 * "aj4", "jordan4" and "nb 550" all find their shoes. Lower-cases, strips apostrophes, collapses spaces.
 */
export function normalizeQuery(raw: string): string {
  let s = raw.toLowerCase().replace(/[’'`]/g, '').replace(/\s+/g, ' ').trim();
  const rules: Array<[RegExp, string]> = [
    [/\bairforce\s*(\d*)\b/g, 'air force $1'],
    [/\bairmax\s*(\d*)\b/g, 'air max $1'],
    [/\baf-?1\b/g, 'air force 1'],
    [/\baj-?(\d{1,2})\b/g, 'jordan $1'],
    [/\bnewbalance\b/g, 'new balance'],
    [/\bnb\b/g, 'new balance'],
    [/\b(jordan|dunk|yeezy|samba|gazelle|campus|forum|kayano)s\b/g, '$1'],
    [/\b(jordan|dunk|yeezy|new balance|nb|ultraboost|pegasus|vomero)(\d{1,4})\b/g, '$1 $2'],
  ];
  for (const [re, to] of rules) s = s.replace(re, to);
  return s.replace(/\s+/g, ' ').trim();
}
