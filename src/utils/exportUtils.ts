import type { PatternGrid } from "../types/pattern";
import { textColorForBackground } from "./colorUtils";

export function exportPatternPng(name: string, grid: PatternGrid, options: { showDone: boolean; showSymbols: boolean; showCoordinates: boolean }) {
  const cell = 18;
  const coord = options.showCoordinates ? 28 : 0;
  const width = grid[0].length * cell + coord;
  const height = grid.length * cell + coord;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法建立匯出畫布");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.font = "10px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const row of grid) {
    for (const c of row) {
      const x = coord + c.col * cell;
      const y = coord + c.row * cell;
      if (!c.empty && c.colorCode) {
        ctx.fillStyle = c.hex;
        ctx.fillRect(x, y, cell, cell);
        if (options.showSymbols) {
          ctx.fillStyle = textColorForBackground(c.hex);
          ctx.fillText(c.symbol, x + cell / 2, y + cell / 2);
        }
        if (options.showDone && c.done) {
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillRect(x, y, cell, cell);
          ctx.fillStyle = "#111827";
          ctx.fillText("✓", x + cell / 2, y + cell / 2);
        }
      }
      ctx.strokeStyle = c.row % 10 === 0 || c.col % 10 === 0 ? "#111827" : c.row % 5 === 0 || c.col % 5 === 0 ? "#6b7280" : "#d1d5db";
      ctx.lineWidth = c.row % 10 === 0 || c.col % 10 === 0 ? 1.4 : 0.7;
      ctx.strokeRect(x, y, cell, cell);
    }
  }
  if (options.showCoordinates) {
    ctx.fillStyle = "#111827";
    for (let col = 0; col < grid[0].length; col += 5) ctx.fillText(String(col + 1), coord + col * cell + cell / 2, 14);
    for (let row = 0; row < grid.length; row += 5) ctx.fillText(String(row + 1), 14, coord + row * cell + cell / 2);
  }
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  const date = new Date().toISOString().slice(0, 10);
  a.download = `BeadFlow_${name}_${grid[0].length}x${grid.length}_${date}.png`;
  a.click();
}
