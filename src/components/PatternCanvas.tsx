import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { PatternGrid } from "../types/pattern";
import type { ActiveTool } from "./DrawingToolbar";
import { canvasToWorld, clamp } from "../utils/canvasMath";
import { textColorForBackground } from "../utils/colorUtils";

type Point = { x: number; y: number };
type PointerPoint = Point & { clientX: number; clientY: number };
type GestureState = {
  startDistance: number;
  startZoom: number;
  worldCenter: Point;
};

const CELL_SIZE = 20;
const EDIT_DRAG_TOOLS: ActiveTool[] = ["paint", "eraser"];
const TAP_TOOLS: ActiveTool[] = ["inspect", "eyedropper", "fill", "replaceColor"];

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
  const pointers = useRef(new Map<number, PointerPoint>());
  const gesture = useRef<GestureState | null>(null);
  const pointerStart = useRef<PointerPoint | null>(null);
  const lastPanPoint = useRef<PointerPoint | null>(null);
  const lastPaintKey = useRef("");
  const moved = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 24, y: 24 });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#f6f7fb";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    drawGrid(ctx, grid, CELL_SIZE, { selectedColorCode, showGrid, showSymbols, showCoordinates, onlyUnfinished });
    ctx.restore();
  }, [grid, zoom, pan, selectedColorCode, showGrid, showSymbols, showCoordinates, onlyUnfinished]);

  const cellAt = (clientX: number, clientY: number) => {
    const canvas = ref.current;
    if (!canvas || !grid.length || !grid[0]?.length) return null;
    const rect = canvas.getBoundingClientRect();
    const world = canvasToWorld(clientX - rect.left, clientY - rect.top, { zoom, panX: pan.x, panY: pan.y });
    const coordOffset = showCoordinates ? 24 : 0;
    const col = Math.floor((world.x - coordOffset) / CELL_SIZE);
    const row = Math.floor((world.y - coordOffset) / CELL_SIZE);
    if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) return { row, col };
    return null;
  };

  const runActionAt = (clientX: number, clientY: number, tool: ActiveTool) => {
    const hit = cellAt(clientX, clientY);
    if (!hit) return;
    const key = `${hit.row}:${hit.col}:${tool}`;
    if (EDIT_DRAG_TOOLS.includes(tool) && key === lastPaintKey.current) return;
    lastPaintKey.current = key;
    onCellAction(hit.row, hit.col, tool);
  };

  const zoomAtCenter = (nextZoom: number) => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenCenter = { x: rect.width / 2, y: rect.height / 2 };
    const worldCenter = canvasToWorld(screenCenter.x, screenCenter.y, { zoom, panX: pan.x, panY: pan.y });
    const clamped = clamp(nextZoom, 0.25, 5);
    setZoom(clamped);
    setPan({ x: screenCenter.x - worldCenter.x * clamped, y: screenCenter.y - worldCenter.y * clamped });
  };

  return (
    <div className="canvas-wrap">
      <div className="canvas-tools" aria-label="畫布檢視控制">
        <button type="button" onClick={() => zoomAtCenter(zoom + 0.2)}>放大</button>
        <button type="button" onClick={() => zoomAtCenter(zoom - 0.2)}>縮小</button>
        <button type="button" onClick={() => { setZoom(1); setPan({ x: 24, y: 24 }); }}>重置視圖</button>
        <span className="canvas-hint">手機可單指拖曳檢視，雙指縮放。</span>
      </div>
      <canvas
        ref={ref}
        className="pattern-canvas"
        onWheel={(event) => {
          event.preventDefault();
          zoomAtCenter(zoom + (event.deltaY > 0 ? -0.12 : 0.12));
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          const canvas = event.currentTarget as HTMLCanvasElement;
          canvas.setPointerCapture(event.pointerId);
          const point = toPoint(event);
          pointers.current.set(event.pointerId, point);
          pointerStart.current = point;
          lastPanPoint.current = point;
          moved.current = false;
          lastPaintKey.current = "";
          if (pointers.current.size === 2) {
            gesture.current = createGesture(Array.from(pointers.current.values()), zoom, pan, ref.current);
            return;
          }
          if (EDIT_DRAG_TOOLS.includes(activeTool)) runActionAt(event.clientX, event.clientY, activeTool);
        }}
        onPointerMove={(event) => {
          event.preventDefault();
          const nextPoint = toPoint(event);
          if (!pointers.current.has(event.pointerId)) return;
          pointers.current.set(event.pointerId, nextPoint);
          const points = Array.from(pointers.current.values());
          if (points.length >= 2) {
            if (!gesture.current) gesture.current = createGesture(points, zoom, pan, ref.current);
            const currentGesture = gesture.current;
            if (!currentGesture) return;
            const center = midpoint(points[0], points[1]);
            const scale = distance(points[0], points[1]) / Math.max(currentGesture.startDistance, 1);
            const nextZoom = clamp(currentGesture.startZoom * scale, 0.25, 5);
            setZoom(nextZoom);
            setPan({
              x: center.x - currentGesture.worldCenter.x * nextZoom,
              y: center.y - currentGesture.worldCenter.y * nextZoom
            });
            moved.current = true;
            return;
          }
          const start = pointerStart.current;
          if (start && distance(start, nextPoint) > 5) moved.current = true;
          if (EDIT_DRAG_TOOLS.includes(activeTool)) {
            runActionAt(event.clientX, event.clientY, activeTool);
            return;
          }
          const last = lastPanPoint.current;
          if (last) setPan((value) => ({ x: value.x + event.clientX - last.clientX, y: value.y + event.clientY - last.clientY }));
          lastPanPoint.current = nextPoint;
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          if (TAP_TOOLS.includes(activeTool) && pointers.current.size === 1 && !moved.current) runActionAt(event.clientX, event.clientY, activeTool);
          pointers.current.delete(event.pointerId);
          gesture.current = null;
          pointerStart.current = null;
          lastPanPoint.current = null;
          lastPaintKey.current = "";
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          gesture.current = null;
          pointerStart.current = null;
          lastPanPoint.current = null;
          lastPaintKey.current = "";
        }}
      />
    </div>
  );
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: PatternGrid,
  cell: number,
  options: { selectedColorCode: string | null; showGrid: boolean; showSymbols: boolean; showCoordinates: boolean; onlyUnfinished: boolean }
) {
  if (!grid.length || !grid[0]?.length) return;
  const coord = options.showCoordinates ? 24 : 0;
  ctx.font = "9px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const row of grid) {
    for (const c of row) {
      const x = coord + c.col * cell;
      const y = coord + c.row * cell;
      const isEmpty = c.empty || !c.colorCode;
      const isSelected = Boolean(options.selectedColorCode && c.colorCode === options.selectedColorCode);
      const highlight = !options.selectedColorCode || isSelected;
      const hiddenByDone = options.onlyUnfinished && c.done;
      ctx.globalAlpha = isEmpty ? 0.45 : hiddenByDone ? 0.08 : highlight ? 1 : 0.22;
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
        ctx.strokeStyle = isSelected ? "#111827" : c.row % 10 === 0 || c.col % 10 === 0 ? "#4b5563" : c.row % 5 === 0 || c.col % 5 === 0 ? "#9ca3af" : "#d1d5db";
        ctx.lineWidth = isSelected ? 1.8 : c.row % 10 === 0 || c.col % 10 === 0 ? 1.2 : 0.5;
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

function toPoint(event: PointerEvent<HTMLCanvasElement>): PointerPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top, clientX: event.clientX, clientY: event.clientY };
}

function createGesture(points: PointerPoint[], zoom: number, pan: Point, canvas: HTMLCanvasElement | null): GestureState | null {
  if (points.length < 2 || !canvas) return null;
  const center = midpoint(points[0], points[1]);
  const worldCenter = canvasToWorld(center.x, center.y, { zoom, panX: pan.x, panY: pan.y });
  return { startDistance: distance(points[0], points[1]), startZoom: zoom, worldCenter };
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
