import type { ColorStat, PatternGrid } from "../types/pattern";
import { isEmptyOrTransparentCell } from "../data/emptyColor";

export function calculateColorStats(grid: PatternGrid): ColorStat[] {
  const map = new Map<string, ColorStat>();
  for (const row of grid) {
    for (const cell of row) {
      if (isEmptyOrTransparentCell(cell)) continue;
      const current = map.get(cell.colorCode) ?? {
        code: cell.colorCode,
        name: cell.colorName,
        hex: cell.hex,
        symbol: cell.symbol,
        total: 0,
        done: 0,
        remaining: 0,
        percent: 0
      };
      current.total += 1;
      current.done += cell.done ? 1 : 0;
      current.remaining = current.total - current.done;
      current.percent = current.total ? Math.round((current.done / current.total) * 100) : 0;
      map.set(cell.colorCode, current);
    }
  }
  return Array.from(map.values());
}

export function totalCells(grid: PatternGrid): number {
  return grid.reduce((sum, row) => sum + row.filter((cell) => !isEmptyOrTransparentCell(cell)).length, 0);
}

export function completePercent(grid: PatternGrid): number {
  const total = totalCells(grid);
  if (!total) return 0;
  const done = grid.flat().filter((cell) => !isEmptyOrTransparentCell(cell) && cell.done).length;
  return Math.round((done / total) * 100);
}
