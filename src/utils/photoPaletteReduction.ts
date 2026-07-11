import type { BeadColor } from "../types/bead";
import type { PatternGrid } from "../types/pattern";
import { isEmptyOrTransparentCell } from "../data/emptyColor";
import { findClosestBeadColorWithDebug, hexToRgb, oklabDistance, rgbToOklab } from "./colorUtils";

export type PhotoColorLimit = 0 | 24 | 48 | 72 | 96;

export function reducePatternPalette(grid: PatternGrid, palette: BeadColor[], limit: PhotoColorLimit): PatternGrid {
  if (!limit) return grid;
  const colorCounts = new Map<string, { color: BeadColor; count: number }>();
  const paletteByCode = new Map(palette.map((color) => [color.code, color]));
  for (const row of grid) {
    for (const cell of row) {
      if (isEmptyOrTransparentCell(cell)) continue;
      const color = paletteByCode.get(cell.colorCode);
      if (!color) continue;
      const current = colorCounts.get(color.code) ?? { color, count: 0 };
      current.count += 1;
      colorCounts.set(color.code, current);
    }
  }
  const entries = Array.from(colorCounts.values()).sort((a, b) => b.count - a.count);
  if (entries.length <= limit) return grid;
  const selected = pickRepresentativePalette(entries, limit);
  const selectedByCode = new Set(selected.map((color) => color.code));
  return grid.map((row) => row.map((cell) => {
    if (isEmptyOrTransparentCell(cell) || selectedByCode.has(cell.colorCode)) return cell;
    const sourceRgb = hexToRgb(cell.hex);
    const match = findClosestBeadColorWithDebug(sourceRgb, selected);
    return {
      ...cell,
      colorCode: match.color.code,
      colorName: match.color.name,
      hex: match.color.hex,
      symbol: match.color.symbol,
      matchedHex: match.color.hex,
      distance: match.distance,
      adjustedDistance: match.adjustedDistance,
      confidence: match.confidence,
      candidates: match.candidates
    };
  }));
}

function pickRepresentativePalette(entries: Array<{ color: BeadColor; count: number }>, limit: number): BeadColor[] {
  const selected: BeadColor[] = [entries[0].color];
  const remaining = entries.slice(1);
  const maxCount = entries[0].count;
  while (selected.length < limit && remaining.length) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const diversity = Math.min(...selected.map((color) => perceptualDistance(candidate.color, color)));
      const weight = candidate.count / maxCount;
      const score = diversity * 0.72 + weight * 18;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    selected.push(remaining.splice(bestIndex, 1)[0].color);
  }
  return selected;
}

function perceptualDistance(a: BeadColor, b: BeadColor): number {
  return oklabDistance(rgbToOklab(hexToRgb(a.hex)), rgbToOklab(hexToRgb(b.hex)));
}
