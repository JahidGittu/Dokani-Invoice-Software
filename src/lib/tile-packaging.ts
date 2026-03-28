// Standard tile packaging data for Bangladesh market
export interface TilePackaging {
  height: string;
  width: string;
  label: string;
  piecesPerBox: number;
  sqftPerBox: number;
}

export const TILE_PACKAGING: TilePackaging[] = [
  { height: '12', width: '12', label: '12×12 (30×30cm)', piecesPerBox: 10, sqftPerBox: 9.69 },
  { height: '16', width: '16', label: '16×16 (40×40cm)', piecesPerBox: 6, sqftPerBox: 10.33 },
  { height: '12', width: '24', label: '12×24 (30×60cm)', piecesPerBox: 8, sqftPerBox: 15.50 },
  { height: '24', width: '24', label: '24×24 (60×60cm)', piecesPerBox: 4, sqftPerBox: 15.50 },
  { height: '32', width: '32', label: '32×32 (80×80cm)', piecesPerBox: 3, sqftPerBox: 20.66 },
  { height: '24', width: '48', label: '24×48 (60×120cm)', piecesPerBox: 2, sqftPerBox: 15.50 },
  { height: '40', width: '40', label: '40×40 (100×100cm)', piecesPerBox: 2, sqftPerBox: 21.52 },
];

export const TILE_BRANDS = [
  'Akij', 'RAK', 'DBL', 'Great Wall', 'Mir', 'Star', 'Fresh', 'TYT', 'China', 'Bangla',
];

/**
 * Given height and width, find matching packaging and return piecesPerBox.
 * Returns undefined if no match found.
 */
export function getAutoPackaging(height: string, width: string): TilePackaging | undefined {
  const h = height.trim();
  const w = width.trim();
  if (!h || !w) return undefined;
  return TILE_PACKAGING.find(
    t => (t.height === h && t.width === w) || (t.height === w && t.width === h)
  );
}

/**
 * Common tile sizes as dropdown/suggestion options
 */
export const TILE_SIZE_OPTIONS = TILE_PACKAGING.map(t => ({
  value: `${t.height}×${t.width}`,
  label: t.label,
  height: t.height,
  width: t.width,
  piecesPerBox: t.piecesPerBox,
}));
