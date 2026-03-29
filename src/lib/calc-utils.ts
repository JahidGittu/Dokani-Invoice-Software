/**
 * Centralized calculation utilities for tile shop POS.
 * 
 * KEY RULES:
 * - SQFT unit: rate is per square foot → subTotal = sqftQty × rate
 * - Non-SQFT units (Piece, Set, KG, etc.): rate is per unit → subTotal = qty × rate
 * - sqftPerBox = (height_cm × width_cm × piecesPerBox) / 929.0304
 */

import type { Product } from './store';

// ─── Constants ───
const SQ_CM_PER_SQ_FT = 929.0304;

// ─── sqftPerBox auto-calculation ───
export function calcSqftPerBox(heightCm: number, widthCm: number, piecesPerBox: number): number {
  if (heightCm <= 0 || widthCm <= 0 || piecesPerBox <= 0) return 0;
  return parseFloat(((heightCm * widthCm * piecesPerBox) / SQ_CM_PER_SQ_FT).toFixed(2));
}

export function calcSqftPerBoxFromStrings(height: string, width: string, piecesPerBox: string, unit: string): number {
  if (unit !== 'SQFT') return 0;
  return calcSqftPerBox(parseFloat(height) || 0, parseFloat(width) || 0, parseInt(piecesPerBox) || 0);
}

// ─── Check if product uses SQFT pricing ───
export function isSqftUnit(unit?: string): boolean {
  return (unit || 'SQFT') === 'SQFT';
}

// ─── Get product's sqft helpers ───
function getSqftPerPiece(product: Product): number {
  const pcs = product.piecesPerBox || 4;
  const sqft = product.sqftPerBox || 0;
  return pcs > 0 ? sqft / pcs : 0;
}

// ─── Calculate sqftQty from carton + piece ───
export function calcSqftQty(product: Product, carton: number, piece: number): number {
  const sqftPerBox = product.sqftPerBox || 0;
  const sqftPerPiece = getSqftPerPiece(product);
  return (carton * sqftPerBox) + (piece * sqftPerPiece);
}

// ─── Calculate carton + piece from sqftQty ───
export function calcCartonPieceFromSqft(product: Product, totalSqft: number): { carton: number; piece: number } {
  const sqftPerBox = product.sqftPerBox || 0;
  const piecesPerBox = product.piecesPerBox || 4;
  const sqftPerPiece = getSqftPerPiece(product);

  if (sqftPerBox <= 0 || totalSqft <= 0) return { carton: 0, piece: 0 };

  let carton = Math.floor(totalSqft / sqftPerBox);
  const remainingSqft = totalSqft - (carton * sqftPerBox);
  let piece = sqftPerPiece > 0 ? Math.round(remainingSqft / sqftPerPiece) : 0;

  if (piece >= piecesPerBox) { carton += 1; piece = 0; }

  return { carton, piece };
}

// ─── Calculate subtotal (the core logic) ───
/**
 * For SQFT products: subTotal = sqftQty × rate
 * For non-SQFT products: subTotal = (carton + piece/piecesPerBox) × rate
 *   where rate is per-unit (per box/piece/kg etc.)
 */
export function calcSubTotal(product: Product | undefined, carton: number, piece: number, rate: number): number {
  if (!product) return 0;

  if (isSqftUnit(product.unit)) {
    const sqftQty = calcSqftQty(product, carton, piece);
    return sqftQty * rate;
  } else {
    // Non-SQFT: rate is per unit (box/piece/kg/etc.)
    const piecesPerBox = product.piecesPerBox || 1;
    const totalUnits = carton + (piece / piecesPerBox);
    return totalUnits * rate;
  }
}

// ─── Calculate subtotal from sqftQty directly ───
export function calcSubTotalFromSqft(product: Product | undefined, sqftQty: number, rate: number): number {
  if (!product) return 0;
  if (isSqftUnit(product.unit)) {
    return sqftQty * rate;
  }
  return sqftQty * rate; // for non-SQFT, sqftQty acts as generic qty
}

// ─── Get display sqftQty for a sale/purchase item ───
export function getDisplaySqftQty(product: Product | undefined, carton: number, piece: number): number {
  if (!product) return 0;
  if (isSqftUnit(product.unit)) {
    return calcSqftQty(product, carton, piece);
  }
  // Non-SQFT: just show total qty
  const piecesPerBox = product.piecesPerBox || 1;
  return carton + (piece / piecesPerBox);
}

// ─── For invoice: calculate line item total from stored data ───
export function calcItemTotal(sqftQty: number | undefined, qty: number, price: number, unit?: string): number {
  if (isSqftUnit(unit)) {
    return (sqftQty ?? qty) * price;
  }
  return qty * price;
}
