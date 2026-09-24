/**
 * One sneaker silhouette, defined once as path commands so the flat SVG
 * art (cards, placeholders) and the WebGL model (hero, viewer) are the
 * exact same shoe. Coordinates: viewBox 0 0 130 70, y grows DOWN, toe on
 * the right, ground line at y = 58.
 */
export type Cmd = ['M', number, number] | ['L', number, number] | ['C', number, number, number, number, number, number] | ['Z'];

export const VIEW_W = 130;
export const VIEW_H = 70;

export const SOLE: Cmd[] = [
  ['M', 6, 47],
  ['L', 114, 47],
  ['C', 121, 47, 127, 49.5, 127.5, 53],
  ['C', 127.8, 56, 125, 58, 120, 58],
  ['L', 16, 58],
  ['C', 9.5, 58, 5, 56, 4, 52],
  ['C', 3.6, 49.5, 4.6, 47.6, 6, 47],
  ['Z'],
];

export const UPPER: Cmd[] = [
  ['M', 7, 47.5],
  ['C', 4, 40, 4.5, 32, 8, 24],
  ['C', 10, 20, 16, 18.5, 22, 20.5],
  ['C', 27, 22.2, 30, 27, 36, 26],
  ['C', 38, 20, 42, 15, 48.5, 15],
  ['C', 54, 16, 59, 24.5, 68, 30],
  ['C', 80, 34.5, 97, 32, 109, 37],
  ['C', 119, 40.5, 125, 43, 125, 47.5],
  ['Z'],
];

export const TOE_CAP: Cmd[] = [
  ['M', 92, 32.6],
  ['C', 106, 33.6, 122, 39.5, 125, 47.5],
  ['L', 84, 47.5],
  ['C', 90, 44, 93, 38, 92, 32.6],
  ['Z'],
];

export const HEEL_TAB: Cmd[] = [
  ['M', 7, 47.5],
  ['C', 4, 40, 4.5, 32, 8, 24],
  ['C', 14, 27, 17, 37, 16.5, 47.5],
  ['Z'],
];

export const STRIPE: Cmd[] = [
  ['M', 20, 45],
  ['C', 44, 46.5, 72, 40, 93, 28],
  ['C', 77, 43, 50, 52, 20, 45],
  ['Z'],
];

export const TONGUE: Cmd[] = [
  ['M', 35.5, 27],
  ['C', 37.5, 19.5, 42, 12.5, 49, 12.5],
  ['C', 53.5, 13.5, 55.5, 16.5, 56.5, 20],
  ['C', 52, 19.5, 47, 21.5, 45, 28],
  ['Z'],
];

/** Lace bars: [x1, y1, x2, y2] across the throat. */
export const LACES: Array<[number, number, number, number]> = [
  [47, 17, 42, 25],
  [53, 19.5, 47, 28.5],
  [59, 24, 53, 32],
  [65, 28.5, 59, 35],
  [72, 32.5, 66, 38],
];

export function toSvgPath(cmds: Cmd[]): string {
  return cmds
    .map((c) => {
      switch (c[0]) {
        case 'M':
          return `M${c[1]} ${c[2]}`;
        case 'L':
          return `L${c[1]} ${c[2]}`;
        case 'C':
          return `C${c[1]} ${c[2]} ${c[3]} ${c[4]} ${c[5]} ${c[6]}`;
        case 'Z':
          return 'Z';
      }
    })
    .join(' ');
}
