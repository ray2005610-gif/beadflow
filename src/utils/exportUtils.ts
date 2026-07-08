import type { PatternGrid } from "../types/pattern";
import { textColorForBackground } from "./colorUtils";
import { calculateColorStats, totalCells } from "./patternStats";

export type PatternExportOptions = {
  showDone: boolean;
  showSymbols: boolean;
  showCoordinates: boolean;
  mirrored?: boolean;
  costPerBead?: number;
  titleSuffix?: string;
};

export function exportPatternPng(name: string, grid: PatternGrid, options: PatternExportOptions) {
  if (!grid.length || !grid[0]?.length) return;
  const stats = calculateColorStats(grid);
  const beadCount = totalCells(grid);
  const boardWidth = grid[0].length;
  const boardHeight = grid.length;
  const actual = actualPatternBounds(grid);
  const cell = boardWidth > 90 || boardHeight > 90 ? 14 : boardWidth > 60 || boardHeight > 60 ? 16 : 22;
  const coord = options.showCoordinates ? 34 : 0;
  const margin = 36;
  const titleHeight = 92;
  const tableRowHeight = 28;
  const tableColumns = stats.length > 36 ? 3 : stats.length > 18 ? 2 : 1;
  const tableRows = Math.max(1, Math.ceil(stats.length / tableColumns));
  const tableHeight = 104 + tableRows * tableRowHeight;
  const gridWidth = boardWidth * cell + coord;
  const gridHeight = boardHeight * cell + coord;
  const width = Math.max(980, gridWidth + margin * 2);
  const height = titleHeight + gridHeight + tableHeight + margin * 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法建立匯出畫布");

  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#3f332a";
  ctx.font = "700 28px Microsoft JhengHei, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`BeadFlow｜${name}${options.mirrored ? "（鏡射版）" : ""}`, margin, margin);
  ctx.font = "14px Microsoft JhengHei, sans-serif";
  const cost = Math.round(beadCount * (options.costPerBead ?? 0.1));
  const subtitle = [
    `底板尺寸：${boardWidth} × ${boardHeight}`,
    `實際圖案尺寸：${actual.width} × ${actual.height}`,
    `實際豆數：${beadCount.toLocaleString("zh-TW")} 顆`,
    `使用顏色：${stats.length} 色`,
    "色卡：MARD",
    `預估材料成本：${cost.toLocaleString("zh-TW")} 元`,
    options.mirrored ? "輸出：鏡射" : "輸出：正常"
  ].join("　");
  ctx.fillStyle = "#6f5f51";
  ctx.fillText(subtitle, margin, margin + 42);

  const startX = margin;
  const startY = margin + titleHeight;
  ctx.fillStyle = "#faf7f0";
  roundRect(ctx, startX - 12, startY - 12, gridWidth + 24, gridHeight + 24, 16);
  ctx.fill();

  ctx.font = `${Math.max(8, Math.floor(cell * 0.46))}px Microsoft JhengHei, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const row of grid) {
    for (const c of row) {
      const x = startX + coord + c.col * cell;
      const y = startY + coord + c.row * cell;
      if (!c.empty && c.colorCode) {
        ctx.fillStyle = c.hex;
        ctx.fillRect(x, y, cell, cell);
        if (options.showSymbols && cell >= 13) {
          ctx.fillStyle = textColorForBackground(c.hex);
          ctx.fillText(c.symbol, x + cell / 2, y + cell / 2);
        }
        if (options.showDone && c.done) {
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillRect(x, y, cell, cell);
          ctx.fillStyle = "#3f332a";
          ctx.fillText("✓", x + cell / 2, y + cell / 2);
        }
      } else {
        ctx.fillStyle = (c.row + c.col) % 2 === 0 ? "#fffdf8" : "#f4eadf";
        ctx.fillRect(x, y, cell, cell);
      }
      const major5 = c.row % 5 === 0 || c.col % 5 === 0;
      ctx.strokeStyle = major5 ? "#6f6258" : "#cfc3b5";
      ctx.lineWidth = major5 ? 2.4 : 1;
      ctx.strokeRect(x, y, cell, cell);
    }
  }
  if (options.showCoordinates) {
    ctx.fillStyle = "#5d5047";
    ctx.font = "12px Microsoft JhengHei, sans-serif";
    for (let col = 0; col < boardWidth; col += 5) {
      ctx.fillText(String(col + 1), startX + coord + col * cell + cell / 2, startY + 16);
      ctx.fillText(String(col + 1), startX + coord + col * cell + cell / 2, startY + coord + boardHeight * cell + 16);
    }
    for (let row = 0; row < boardHeight; row += 5) {
      ctx.fillText(String(row + 1), startX + 16, startY + coord + row * cell + cell / 2);
      ctx.fillText(String(row + 1), startX + coord + boardWidth * cell + 18, startY + coord + row * cell + cell / 2);
    }
  }

  const tableY = startY + gridHeight + 52;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#3f332a";
  ctx.font = "700 20px Microsoft JhengHei, sans-serif";
  ctx.fillText("色表與顆數", margin, tableY);
  ctx.font = "14px Microsoft JhengHei, sans-serif";
  const colWidth = (width - margin * 2) / tableColumns;
  stats.forEach((item, index) => {
    const col = index % tableColumns;
    const row = Math.floor(index / tableColumns);
    const x = margin + col * colWidth;
    const y = tableY + 38 + row * tableRowHeight;
    ctx.fillStyle = item.hex;
    ctx.fillRect(x, y + 3, 18, 18);
    ctx.strokeStyle = "rgba(63, 51, 42, 0.25)";
    ctx.strokeRect(x, y + 3, 18, 18);
    ctx.fillStyle = "#3f332a";
    ctx.fillText(`${item.code} ${item.name}　${item.total.toLocaleString("zh-TW")} 顆`, x + 28, y);
  });

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  const date = new Date().toISOString().slice(0, 10);
  a.download = `BeadFlow_${name}_${boardWidth}x${boardHeight}_${options.mirrored ? "mirror_" : ""}${date}.png`;
  a.click();
}

function actualPatternBounds(grid: PatternGrid) {
  const cells = grid.flat().filter((cell) => !cell.empty && cell.colorCode);
  if (!cells.length) return { width: 0, height: 0 };
  const minRow = Math.min(...cells.map((cell) => cell.row));
  const maxRow = Math.max(...cells.map((cell) => cell.row));
  const minCol = Math.min(...cells.map((cell) => cell.col));
  const maxCol = Math.max(...cells.map((cell) => cell.col));
  return { width: maxCol - minCol + 1, height: maxRow - minRow + 1 };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}


