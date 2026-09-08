/**
 * Task 3's "avatar system that doesn't require a real photo" —
 * deterministic, generated from `users.avatar_seed`, never an upload.
 * No third-party image service either (no DiceBear/Gravatar CDN call):
 * generating the pattern locally means no external request per page
 * view leaking who's viewing which profile to a third party, one less
 * host to add to the CSP's `img-src`, and nothing to moderate — a
 * generated pattern can't itself be objectionable content the way an
 * uploaded photo could be.
 *
 * A plain, non-cryptographic string hash (djb2) — this only needs to
 * be deterministic and reasonably well-distributed across a 5x5 grid,
 * not collision-resistant, so Web Crypto's async `subtle.digest` would
 * be pure overhead for a value rendered synchronously in a React
 * component (including during SSR, where sync matters).
 */
function djb2(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return hash >>> 0; // unsigned
}

export interface IdenticonPattern {
  /** 5 rows x 5 cols, mirrored left-right — true = filled. */
  cells: boolean[][];
  /** HSL hue, 0-359. */
  hue: number;
}

const GRID_SIZE = 5;
const HALF_WIDTH = 3; // columns 0-2 are generated; 3-4 mirror 1-0

export function identiconPattern(seed: string): IdenticonPattern {
  const hash = djb2(seed || 'chosn');
  const cells: boolean[][] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    const rowCells: boolean[] = [];
    for (let col = 0; col < HALF_WIDTH; col++) {
      // One hash bit per (row, half-col) cell — 15 cells need 15 bits,
      // well within a 32-bit hash.
      const bitIndex = row * HALF_WIDTH + col;
      rowCells.push(((hash >> bitIndex) & 1) === 1);
    }
    // Mirror columns 0-2 onto 3-4 (column 2 is the grid's own center,
    // not mirrored again).
    cells.push([...rowCells, rowCells[1]!, rowCells[0]!]);
  }

  // A different slice of the same hash for hue, so the pattern and
  // color vary independently rather than always moving together.
  const hue = (hash >> 20) % 360;

  return { cells, hue };
}
