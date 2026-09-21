import type { BeadColor } from "../types/bead";
import type { PatternCell, PatternGrid } from "../types/pattern";
import type { CellSuggestion, LegendEntry, ValidationResult } from "../types/legend";
import { isEmptyOrTransparentCell } from "../data/emptyColor";
import { recognitionPalette } from "../data/recognitionPalette";
import { mardPaletteByCode } from "../data/mardPalette";
import { deltaE2000, hexToRgb, rgbToLab } from "./colorUtils";

function colorLab(color: BeadColor) {
  return rgbToLab(hexToRgb(color.matchHex ?? color.calibratedHex ?? color.referenceHex ?? color.hex));
}

export function buildLegendMatchPalette(legend: LegendEntry[]): BeadColor[] {
  const colors = new Map(recognitionPalette.map((color) => [color.code, color]));
  const result: BeadColor[] = [];
  const seen = new Set<string>();
  for (const entry of legend) {
    const code = entry.colorCode.trim().toUpperCase();
    const official = colors.get(code);
    if (!official || seen.has(code)) continue;
    seen.add(code);
    result.push(entry.swatchColor && /^#[0-9A-F]{6}$/i.test(entry.swatchColor)
      ? { ...official, matchHex: entry.swatchColor }
      : official);
  }
  return result;
}

export function assignCellColor(cell: PatternCell, color: BeadColor, reason: PatternCell["correctionReason"]): PatternCell {
  const displayColor = mardPaletteByCode.get(color.code) ?? color;
  return { ...cell, colorCode: displayColor.code, colorName: displayColor.name, hex: displayColor.hex, symbol: displayColor.symbol,
    finalDetectedColor: color.code, correctionReason: reason, empty: false, done: false,
    suspectedMismatch: false, validationConfirmed: reason === "manual" };
}

export function correctIsolatedCells(grid: PatternGrid, palette: BeadColor[]): PatternGrid {
  const colors = new Map(palette.map(color => [color.code, { color, lab: colorLab(color) }]));
  return grid.map((row, r) => row.map((cell, c) => {
    if (isEmptyOrTransparentCell(cell) || !cell.rawRgb || cell.validationConfirmed) return cell;
    const neighbors: PatternCell[] = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const next = grid[r + dr]?.[c + dc];
      if (next && !isEmptyOrTransparentCell(next)) neighbors.push(next);
    }
    if (neighbors.length !== 8 || neighbors.some(n => n.colorCode === cell.colorCode)) return cell;
    const counts = new Map<string, number>();
    for (const n of neighbors) counts.set(n.colorCode, (counts.get(n.colorCode) ?? 0) + 1);
    const dominant = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (!dominant || dominant[1] < 7) return cell;
    const alternative = colors.get(dominant[0]);
    const current = colors.get(cell.colorCode);
    if (!alternative || !current) return cell;
    const source = rgbToLab(cell.rawRgb);
    const currentDistance = deltaE2000(source, current.lab);
    const alternativeDistance = deltaE2000(source, alternative.lab);
    const localDifferences = neighbors.filter(n => n.colorCode === dominant[0] && n.rawRgb)
      .map(n => deltaE2000(source, rgbToLab(n.rawRgb!)));
    // Strong original contrast is evidence of a real eye/highlight, not noise.
    if (localDifferences.length < 7 || Math.max(...localDifferences) > 5) return cell;
    if (alternativeDistance <= 8 && alternativeDistance - currentDistance <= 0.8 && (cell.confidence ?? 0) >= 0.65) {
      return assignCellColor(cell, alternative.color, "neighbor");
    }
    return { ...cell, suspectedMismatch: true };
  }));
}

export function validateLegend(grid: PatternGrid, legend: LegendEntry[], palette = recognitionPalette): ValidationResult {
  const allowed = new Map(palette.map(c => [c.code, c]));
  const unique = new Map<string, LegendEntry>();
  for (const entry of legend) {
    if (allowed.has(entry.colorCode) && Number.isSafeInteger(entry.expectedCount) && entry.expectedCount >= 0) unique.set(entry.colorCode, entry);
  }
  const counts = new Map<string, number>();
  let detectedTotal = 0;
  for (const row of grid) for (const cell of row) if (!isEmptyOrTransparentCell(cell)) {
    counts.set(cell.colorCode, (counts.get(cell.colorCode) ?? 0) + 1);
    detectedTotal++;
  }
  const entries = [...unique.values()].map(e => ({ ...e, detectedCount: counts.get(e.colorCode) ?? 0, difference: (counts.get(e.colorCode) ?? 0) - e.expectedCount }));
  const unexpected = [...counts].filter(([code]) => !unique.has(code)).map(([colorCode, detectedCount]) => ({ colorCode, detectedCount }));
  const deficits = entries.filter(e => e.difference < 0).map(e => ({ entry: e, lab: colorLab(allowed.get(e.colorCode)!) }));
  const surplus = new Map(entries.filter(e => e.difference > 0).map(e => [e.colorCode, e.difference]));
  // Unknown legend colors are shown, but never treated as expendable surplus.
  const candidates: CellSuggestion[] = [];
  const labs = new Map(palette.map(c => [c.code, colorLab(c)]));
  for (const row of grid) for (const cell of row) {
    if (!surplus.has(cell.colorCode) || !cell.rawRgb || cell.validationConfirmed || isEmptyOrTransparentCell(cell)) continue;
    const currentLab = labs.get(cell.colorCode);
    if (!currentLab) continue;
    const source = rgbToLab(cell.rawRgb);
    const currentDistance = deltaE2000(source, currentLab);
    for (const { entry, lab } of deficits) {
      const alternativeDistance = deltaE2000(source, lab);
      const neighborSupport = countNeighborSupport(grid, cell.row, cell.col, entry.colorCode);
      const ambiguityAllowance = neighborSupport >= 3 ? 3.25 : 2;
      if (alternativeDistance > 12 || alternativeDistance - currentDistance > ambiguityAllowance) continue;
      const fromEntry = unique.get(cell.colorCode)!;
      candidates.push({ row: cell.row, col: cell.col, from: cell.colorCode, to: entry.colorCode, currentDistance, alternativeDistance,
        safe: entry.confirmed && fromEntry.confirmed && entry.confidence >= 0.9 && fromEntry.confidence >= 0.9
          && (cell.confidence ?? 0) >= 0.55 && currentDistance <= 12
          && alternativeDistance - currentDistance <= (neighborSupport >= 3 ? 1.8 : 0.8) });
    }
  }
  candidates.sort((a,b) => (a.alternativeDistance - a.currentDistance) - (b.alternativeDistance - b.currentDistance) || a.alternativeDistance - b.alternativeDistance);
  const missing = new Map(deficits.map(d => [d.entry.colorCode, -d.entry.difference]));
  const used = new Set<string>();
  const suspiciousCells = candidates.filter(s => {
    const key = `${s.row}:${s.col}`;
    if (used.has(key) || !surplus.get(s.from) || !missing.get(s.to)) return false;
    used.add(key); surplus.set(s.from, surplus.get(s.from)! - 1); missing.set(s.to, missing.get(s.to)! - 1);
    return true;
  });
  return { expectedTotal: entries.reduce((n,e) => n + e.expectedCount,0), detectedTotal, entries, unexpected, suspiciousCells };
}

function countNeighborSupport(grid: PatternGrid, row: number, col: number, colorCode: string): number {
  let count = 0;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (!dr && !dc) continue;
      const neighbor = grid[row + dr]?.[col + dc];
      if (neighbor && !isEmptyOrTransparentCell(neighbor) && neighbor.colorCode === colorCode) count += 1;
    }
  }
  return count;
}

export function applySafeCorrections(grid: PatternGrid, legend: LegendEntry[], palette = recognitionPalette): PatternGrid {
  const validation = validateLegend(grid, legend, palette);
  const colors = new Map(palette.map(c => [c.code, c]));
  const corrections = new Map(validation.suspiciousCells.filter(s => s.safe).map(s => [`${s.row}:${s.col}`, s]));
  const suspected = new Set(validation.suspiciousCells.map(s => `${s.row}:${s.col}`));
  return grid.map(row => row.map(cell => {
    const s = corrections.get(`${cell.row}:${cell.col}`);
    return s ? assignCellColor(cell, colors.get(s.to)!, "legend") : suspected.has(`${cell.row}:${cell.col}`) ? { ...cell, suspectedMismatch: true } : cell;
  }));
}
