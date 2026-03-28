// Standard tile packaging data for Bangladesh market
export interface TilePackaging {
  height: string;
  width: string;
  label: string;
  piecesPerBox: number;
  sqftPerBox: number;
}

export const TILE_PACKAGING: TilePackaging[] = [
  { height: '30', width: '30', label: '30×30 সে.মি.', piecesPerBox: 10, sqftPerBox: 9.69 },
  { height: '40', width: '40', label: '40×40 সে.মি.', piecesPerBox: 6, sqftPerBox: 10.33 },
  { height: '30', width: '60', label: '30×60 সে.মি.', piecesPerBox: 8, sqftPerBox: 15.50 },
  { height: '60', width: '60', label: '60×60 সে.মি.', piecesPerBox: 4, sqftPerBox: 15.50 },
  { height: '80', width: '80', label: '80×80 সে.মি.', piecesPerBox: 3, sqftPerBox: 20.66 },
  { height: '60', width: '120', label: '60×120 সে.মি.', piecesPerBox: 2, sqftPerBox: 15.50 },
  { height: '100', width: '100', label: '100×100 সে.মি.', piecesPerBox: 2, sqftPerBox: 21.52 },
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
