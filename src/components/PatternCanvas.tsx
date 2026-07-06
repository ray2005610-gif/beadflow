import { useEffect, useRef, useState } from "react";
import type { PatternCell, PatternGrid } from "../types/pattern";
import type { ActiveTool } from "./DrawingToolbar";
import { canvasToWorld, clamp } from "../utils/canvasMath";
import { textColorForBackground } from "../utils/colorUtils";

export function PatternCanvas({
  grid,
  activeTool,
  selectedColorCode,
  showGrid,
  showSymbols,
  showCoordinates,
  onlyUnfinished,
  onCellAction
}: {
  grid: PatternGrid;
  activeTool: ActiveTool;
  selectedColorCode: string | null;
  showGrid: boolean;
  showSymbols: boolean;
  showCoordinates: boolean;
  onlyUnfinished: boolean;
  onCellAction: (row: number, col: number, tool: ActiveTool) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [drawing, setDrawing] = useState(false);
  const [panning, setPanning] = useState(false);
  const [hoverCell, setHoverCell] = useState<PatternCell | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const cellSize = 20;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * window.devicePixelRatio);
    canvas.height = Math.floor(rect.height * window.devicePixelRatio);
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#f6f7fb";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    drawGrid(ctx, grid, cellSize, { selectedColorCode, showGrid, showSymbols, showCoordinates, onlyUnfinished });
    ctx.restore();
  }, [grid, zoom, pan, selectedColorCode, showGrid, showSymbols, showCoordinates, onlyUnfinished]);

  const cellAt = (clientX: number, clientY: number) => {
    const canvas = ref.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const world = canvasToWorld(clientX - rect.left, clientY - rect.top, { zoom, panX: pan.x, panY: pan.y });
    const coordOffset = showCoordinates ? 24 : 0;
    const col = Math.floor((world.x - coordOffset) / cellSize);
    const row = Math.floor((world.y - coordOffset) / cellSize);
    if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) return { row, col, cell: grid[row][col] };
    return null;
  };

  const actionAt = (clientX: number, clientY: number) => {
    const hit = cellAt(clientX, clientY);
    if (hit) onCellAction(hit.row, hit.col, activeTool);
  };

  return (
    <div className="canvas-wrap">
      <canvas
        ref={ref}
        className="pattern-canvas"
        onWheel={(event) => {
          event.preventDefault();
          setZoom((value) => clamp(value + (event.deltaY > 0 ? -0.08 : 0.08), 0.25, 4));
        }}
        onPointerDown={(event) => {
          (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
          last.current = { x: event.clientX, y: event.clientY };
          if (event.button === 1 || event.shiftKey) setPanning(true);
          else {
            setDrawing(true);
            actionAt(event.clientX, event.clientY);
          }
        }}
        onPointerMove={(event) => {
          const hit = cellAt(event.clientX, event.clientY);
          setHoverCell(hit?.cell ?? null);
          if (panning) {
            setPan((value) => ({ x: value.x + event.clientX - last.current.x, y: value.y + event.clientY - last.current.y }));
            last.current = { x: event.clientX, y: event.clientY };
          } else if (drawing && activeTool !== "eyedropper" && activeTool !== "fill" && activeTool !== "replaceColor") {
            actionAt(event.clientX, event.clientY);
          }
        }}
        onPointerUp={() => {
          setDrawing(false);
          setPanning(false);
        }}
        onPointerCancel={() => {
          setDrawing(false);
          setPanning(false);
        }}
      />
      {hoverCell && <CellDebug cell={hoverCell} />}
    </div>
  );
}

function CellDebug({ cell }: { cell: PatternCell }) {
  return (
    <div className="cell-debug">
      <strong>列 {cell.row + 1} / 欄 {cell.col + 1}</strong>
      {cell.sourceRow != null && cell.sourceCol != null && <span>來源 {cell.sourceRow + 1}/{cell.sourceCol + 1}</span>}
      <span>{cell.empty ? "空白" : `${cell.colorCode} ${cell.hex}`}</span>
      <span>原色 {cell.rawHex ?? "-"} / 信心 {cell.confidence == null ? "-" : `${Math.round(cell.confidence * 100)}%`}</span>
      <span>H {cell.rawHue == null ? "-" : Math.round(cell.rawHue * 360)} / S {cell.rawSaturation == null ? "-" : cell.rawSaturation.toFixed(2)}</span>
      <span>距離 {cell.distance?.toFixed(1) ?? "-"} / 修正 {cell.adjustedDistance?.toFixed(1) ?? "-"}</span>
      <span>候選 {cell.candidates?.map((candidate) => `${candidate.code}:${candidate.adjustedDistance?.toFixed(0) ?? candidate.distance.toFixed(0)} H${candidate.hue == null ? "-" : Math.round(candidate.hue * 360)}`).join("、") ?? "-"}</span>
    </div>
  );
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: PatternGrid,
  cell: number,
  options: { selectedColorCode: string | null; showGrid: boolean; showSymbols: boolean; showCoordinates: boolean; onlyUnfinished: boolean }
) {
  const coord = options.showCoordinates ? 24 : 0;
  ctx.font = "9px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const row of grid) {
    for (const c of row) {
      const x = coord + c.col * cell;
      const y = coord + c.row * cell;
      const isEmpty = c.empty || !c.colorCode;
      const highlight = !options.selectedColorCode || c.colorCode === options.selectedColorCode;
      const hiddenByDone = options.onlyUnfinished && c.done;
      ctx.globalAlpha = isEmpty ? 0.55 : hiddenByDone ? 0.08 : highlight ? 1 : 0.22;
      if (isEmpty) {
        drawEmptyCell(ctx, x, y, cell);
      } else {
        ctx.fillStyle = c.hex;
        ctx.fillRect(x, y, cell, cell);
        if (options.showSymbols && cell >= 14) {
          ctx.fillStyle = textColorForBackground(c.hex);
          ctx.fillText(c.symbol, x + cell / 2, y + cell / 2);
        }
        if (c.done) {
          ctx.fillStyle = "rgba(255,255,255,0.45)";
          ctx.fillRect(x, y, cell, cell);
          ctx.fillStyle = "#111827";
          ctx.fillText("✓", x + cell / 2, y + cell / 2);
        }
      }
      ctx.globalAlpha = 1;
      if (options.showGrid) {
        ctx.strokeStyle = c.colorCode === options.selectedColorCode ? "#111827" : c.row % 10 === 0 || c.col % 10 === 0 ? "#4b5563" : c.row % 5 === 0 || c.col % 5 === 0 ? "#9ca3af" : "#d1d5db";
        ctx.lineWidth = c.colorCode === options.selectedColorCode ? 1.8 : c.row % 10 === 0 || c.col % 10 === 0 ? 1.2 : 0.5;
        ctx.strokeRect(x, y, cell, cell);
      }
    }
  }
  if (options.showCoordinates) {
    ctx.fillStyle = "#374151";
    for (let col = 0; col < grid[0].length; col += 5) ctx.fillText(String(col + 1), coord + col * cell + cell / 2, 12);
    for (let row = 0; row < grid.length; row += 5) ctx.fillText(String(row + 1), 12, coord + row * cell + cell / 2);
  }
}

function drawEmptyCell(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, cell, cell);
  ctx.fillStyle = "#eef1f7";
  ctx.fillRect(x, y, cell / 2, cell / 2);
  ctx.fillRect(x + cell / 2, y + cell / 2, cell / 2, cell / 2);
}
