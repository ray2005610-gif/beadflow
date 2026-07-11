import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { PatternGrid } from "../types/pattern";
import type { BoardLayout, PatternRenderMode, SelectedCell, ViewTransform } from "../types/craft";
import { isEmptyOrTransparentCell } from "../data/emptyColor";
import type { ActiveTool } from "./DrawingToolbar";
import { clamp } from "../utils/canvasMath";
import { textColorForBackground } from "../utils/colorUtils";
import { getVisibleGridRange, gridToScreenPoint, screenToGridPoint, tileForCell } from "../utils/craftViewUtils";

type Point = { x: number; y: number };
type PointerPoint = Point & { clientX: number; clientY: number };
type GestureState = {
  startDistance: number;
  startScale: number;
  worldCenter: Point;
};

const CELL_SIZE = 20;
const RULER_SIZE = 34;
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
  renderMode,
  craftMode,
  boardLayout,
  focusedBoardId,
  completedBoardIds,
  boardCompletionMode,
  fitRequestKey,
  clearSelectionKey,
  onCellAction,
  onSelectedCellChange,
  onToggleBoardComplete
}: {
  grid: PatternGrid;
  activeTool: ActiveTool;
  selectedColorCode: string | null;
  showGrid: boolean;
  showSymbols: boolean;
  showCoordinates: boolean;
  onlyUnfinished: boolean;
  renderMode: PatternRenderMode;
  craftMode: boolean;
  boardLayout: BoardLayout;
  focusedBoardId: string | null;
  completedBoardIds: string[];
  boardCompletionMode: boolean;
  fitRequestKey: number;
  clearSelectionKey: number;
  onCellAction: (row: number, col: number, tool: ActiveTool) => void;
  onSelectedCellChange: (cell: SelectedCell) => void;
  onToggleBoardComplete: (boardId: string) => void;
}) {
  const contentRef = useRef<HTMLCanvasElement | null>(null);
  const topRulerRef = useRef<HTMLCanvasElement | null>(null);
  const leftRulerRef = useRef<HTMLCanvasElement | null>(null);
  const pointers = useRef(new Map<number, PointerPoint>());
  const gesture = useRef<GestureState | null>(null);
  const pointerStart = useRef<PointerPoint | null>(null);
  const lastPanPoint = useRef<PointerPoint | null>(null);
  const lastPaintKey = useRef("");
  const moved = useRef(false);
  const rafCell = useRef<number | null>(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [transform, setTransform] = useState<ViewTransform>({ scale: 1, offsetX: 24, offsetY: 24 });
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const selectedCellData = selectedCell ? grid[selectedCell.row]?.[selectedCell.col] : null;
  const completedSet = useMemo(() => new Set(completedBoardIds), [completedBoardIds]);

  useEffect(() => {
    const canvas = contentRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setViewport({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    drawAll();
  }, [boardCompletionMode, boardLayout, completedSet, craftMode, focusedBoardId, grid, onlyUnfinished, renderMode, selectedCell, selectedColorCode, showCoordinates, showGrid, showSymbols, transform, viewport]);

  useEffect(() => {
    if (!focusedBoardId) {
      fitToBounds(0, 0, grid[0]?.length ?? 1, grid.length || 1);
      return;
    }
    const tile = boardLayout.tiles.find((item) => item.id === focusedBoardId);
    if (tile) fitToBounds(tile.startCol, tile.startRow, tile.endCol - tile.startCol, tile.endRow - tile.startRow);
  }, [focusedBoardId, fitRequestKey]);

  useEffect(() => {
    setSelected(null);
  }, [clearSelectionKey]);

  const setSelected = (cell: SelectedCell) => {
    setSelectedCell(cell);
    onSelectedCellChange(cell);
  };

  const fitToBounds = (startCol: number, startRow: number, width: number, height: number) => {
    const availableWidth = Math.max(1, viewport.width - 32);
    const availableHeight = Math.max(1, viewport.height - 32);
    const nextScale = clamp(Math.min(availableWidth / (width * CELL_SIZE), availableHeight / (height * CELL_SIZE)), 0.25, 5);
    setTransform({
      scale: nextScale,
      offsetX: 16 - startCol * CELL_SIZE * nextScale,
      offsetY: 16 - startRow * CELL_SIZE * nextScale
    });
  };

  const cellAt = (clientX: number, clientY: number) => {
    const canvas = contentRef.current;
    if (!canvas || !grid.length || !grid[0]?.length) return null;
    const rect = canvas.getBoundingClientRect();
    const point = screenToGridPoint(clientX - rect.left, clientY - rect.top, transform, CELL_SIZE);
    if (point.row >= 0 && point.row < grid.length && point.col >= 0 && point.col < grid[0].length) return point;
    return null;
  };

  const runActionAt = (clientX: number, clientY: number, tool: ActiveTool) => {
    const hit = cellAt(clientX, clientY);
    if (!hit) return;
    setSelected(hit);
    if (craftMode && boardCompletionMode) {
      const tile = tileForCell(hit.row, hit.col, boardLayout);
      if (tile) onToggleBoardComplete(tile.id);
      return;
    }
    const key = `${hit.row}:${hit.col}:${tool}`;
    if (EDIT_DRAG_TOOLS.includes(tool) && key === lastPaintKey.current) return;
    lastPaintKey.current = key;
    onCellAction(hit.row, hit.col, tool);
  };

  const zoomAtCenter = (nextScale: number) => {
    const canvas = contentRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenCenter = { x: rect.width / 2, y: rect.height / 2 };
    const worldCenter = {
      x: (screenCenter.x - transform.offsetX) / transform.scale,
      y: (screenCenter.y - transform.offsetY) / transform.scale
    };
    const scale = clamp(nextScale, 0.25, 5);
    setTransform({
      scale,
      offsetX: screenCenter.x - worldCenter.x * scale,
      offsetY: screenCenter.y - worldCenter.y * scale
    });
  };

  const drawAll = () => {
    drawPatternCanvas();
    drawRulers();
  };

  const drawPatternCanvas = () => {
    const canvas = contentRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas, viewport.width, viewport.height);
    if (!ctx) return;
    ctx.fillStyle = "#f7f1e8";
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    if (!grid.length || !grid[0]?.length) return;
    const cols = grid[0].length;
    const rows = grid.length;
    const visible = getVisibleGridRange(viewport.width, viewport.height, transform, CELL_SIZE, rows, cols);
    ctx.save();
    ctx.translate(transform.offsetX, transform.offsetY);
    ctx.scale(transform.scale, transform.scale);
    ctx.font = "9px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let row = visible.startRow; row < visible.endRow; row += 1) {
      for (let col = visible.startCol; col < visible.endCol; col += 1) {
        drawCell(ctx, grid[row][col], col * CELL_SIZE, row * CELL_SIZE);
      }
    }
    if (craftMode) drawBoardGuides(ctx, rows, cols);
    drawCompletionMasks(ctx);
    drawFocusedBoardMask(ctx, rows, cols);
    ctx.restore();
    if (selectedCell) drawCrosshair(ctx, selectedCell, rows, cols);
  };

  const drawCell = (ctx: CanvasRenderingContext2D, cell: PatternGrid[number][number], x: number, y: number) => {
    const empty = isEmptyOrTransparentCell(cell);
    const selected = Boolean(selectedColorCode && cell.colorCode === selectedColorCode);
    const dimmedByHighlight = Boolean(selectedColorCode && !selected);
    const hiddenByDone = onlyUnfinished && cell.done;
    if (empty) {
      drawEmptyCell(ctx, x, y, CELL_SIZE);
    } else if (renderMode === "beads") {
      drawBeadCell(ctx, cell.hex, x, y, CELL_SIZE);
    } else {
      ctx.fillStyle = cell.hex;
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    }
    if (!empty && showSymbols && CELL_SIZE >= 14) {
      ctx.fillStyle = textColorForBackground(cell.hex);
      ctx.fillText(cell.symbol, x + CELL_SIZE / 2, y + CELL_SIZE / 2);
    }
    if (cell.done) {
      ctx.fillStyle = "rgba(255,253,248,0.42)";
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      ctx.fillStyle = "#3f332a";
      ctx.fillText("✓", x + CELL_SIZE / 2, y + CELL_SIZE / 2);
    }
    if (hiddenByDone) {
      ctx.fillStyle = "rgba(39, 31, 25, 0.72)";
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    } else if (dimmedByHighlight) {
      ctx.fillStyle = empty ? "rgba(39, 31, 25, 0.45)" : "rgba(39, 31, 25, 0.68)";
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    }
    if (showGrid) {
      const major5 = cell.row % 5 === 0 || cell.col % 5 === 0;
      ctx.strokeStyle = selected ? "#8c5e3b" : major5 ? "#6f6258" : "#cfc3b5";
      ctx.lineWidth = selected ? 2.4 / transform.scale : major5 ? 1.8 / transform.scale : 1 / transform.scale;
      ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
    }
    if (selected) {
      ctx.strokeStyle = "#b98c62";
      ctx.lineWidth = 3 / transform.scale;
      ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
  };

  const drawRulers = () => {
    drawTopRuler();
    drawLeftRuler();
  };

  const drawTopRuler = () => {
    const canvas = topRulerRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas, viewport.width, RULER_SIZE);
    if (!ctx) return;
    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(0, 0, viewport.width, RULER_SIZE);
    if (!showCoordinates || !grid[0]?.length) return;
    ctx.fillStyle = "#6f5f51";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cols = grid[0].length;
    const startCol = clamp(Math.floor(-transform.offsetX / (CELL_SIZE * transform.scale)) - 1, 0, cols - 1);
    const endCol = clamp(Math.ceil((viewport.width - transform.offsetX) / (CELL_SIZE * transform.scale)) + 2, 0, cols);
    for (let col = startCol; col < endCol; col += 1) {
      const x = transform.offsetX + (col + 0.5) * CELL_SIZE * transform.scale;
      if (col % 5 === 0) ctx.fillText(String(col + 1), x, 17);
      if (col % 5 === 0) {
        ctx.strokeStyle = col % 10 === 0 ? "#8c5e3b" : "#c9a27e";
        ctx.beginPath();
        ctx.moveTo(transform.offsetX + col * CELL_SIZE * transform.scale, RULER_SIZE - 10);
        ctx.lineTo(transform.offsetX + col * CELL_SIZE * transform.scale, RULER_SIZE);
        ctx.stroke();
      }
    }
  };

  const drawLeftRuler = () => {
    const canvas = leftRulerRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas, RULER_SIZE, viewport.height);
    if (!ctx) return;
    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(0, 0, RULER_SIZE, viewport.height);
    if (!showCoordinates || !grid.length) return;
    ctx.fillStyle = "#6f5f51";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const rows = grid.length;
    const startRow = clamp(Math.floor(-transform.offsetY / (CELL_SIZE * transform.scale)) - 1, 0, rows - 1);
    const endRow = clamp(Math.ceil((viewport.height - transform.offsetY) / (CELL_SIZE * transform.scale)) + 2, 0, rows);
    for (let row = startRow; row < endRow; row += 1) {
      const y = transform.offsetY + (row + 0.5) * CELL_SIZE * transform.scale;
      if (row % 5 === 0) ctx.fillText(String(row + 1), 17, y);
      if (row % 5 === 0) {
        ctx.strokeStyle = row % 10 === 0 ? "#8c5e3b" : "#c9a27e";
        ctx.beginPath();
        ctx.moveTo(RULER_SIZE - 10, transform.offsetY + row * CELL_SIZE * transform.scale);
        ctx.lineTo(RULER_SIZE, transform.offsetY + row * CELL_SIZE * transform.scale);
        ctx.stroke();
      }
    }
  };

  const drawBoardGuides = (ctx: CanvasRenderingContext2D, rows: number, cols: number) => {
    ctx.save();
    ctx.strokeStyle = "#8c5e3b";
    ctx.lineWidth = 3 / transform.scale;
    const verticalLines = new Set([0, cols, ...boardLayout.tiles.map((tile) => tile.startCol), ...boardLayout.tiles.map((tile) => tile.endCol)]);
    const horizontalLines = new Set([0, rows, ...boardLayout.tiles.map((tile) => tile.startRow), ...boardLayout.tiles.map((tile) => tile.endRow)]);
    for (const col of verticalLines) {
      ctx.beginPath();
      ctx.moveTo(col * CELL_SIZE, 0);
      ctx.lineTo(col * CELL_SIZE, rows * CELL_SIZE);
      ctx.stroke();
    }
    for (const row of horizontalLines) {
      ctx.beginPath();
      ctx.moveTo(0, row * CELL_SIZE);
      ctx.lineTo(cols * CELL_SIZE, row * CELL_SIZE);
      ctx.stroke();
    }
    ctx.font = `${Math.max(12, 16 / transform.scale)}px Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(63, 51, 42, 0.72)";
    for (const tile of boardLayout.tiles) {
      ctx.fillText(String(tile.index), tile.startCol * CELL_SIZE + 5 / transform.scale, tile.startRow * CELL_SIZE + 5 / transform.scale);
    }
    ctx.restore();
  };

  const drawFocusedBoardMask = (ctx: CanvasRenderingContext2D, rows: number, cols: number) => {
    if (!craftMode || !focusedBoardId) return;
    ctx.fillStyle = "rgba(255, 253, 248, 0.58)";
    for (const tile of boardLayout.tiles) {
      if (tile.id === focusedBoardId) continue;
      ctx.fillRect(tile.startCol * CELL_SIZE, tile.startRow * CELL_SIZE, (tile.endCol - tile.startCol) * CELL_SIZE, (tile.endRow - tile.startRow) * CELL_SIZE);
    }
    ctx.strokeStyle = "#8c5e3b";
    ctx.lineWidth = 4 / transform.scale;
    const tile = boardLayout.tiles.find((item) => item.id === focusedBoardId);
    if (tile) ctx.strokeRect(tile.startCol * CELL_SIZE, tile.startRow * CELL_SIZE, (tile.endCol - tile.startCol) * CELL_SIZE, (tile.endRow - tile.startRow) * CELL_SIZE);
    ctx.strokeRect(0, 0, cols * CELL_SIZE, rows * CELL_SIZE);
  };

  const drawCompletionMasks = (ctx: CanvasRenderingContext2D) => {
    if (!completedSet.size) return;
    for (const tile of boardLayout.tiles) {
      if (!completedSet.has(tile.id)) continue;
      const x = tile.startCol * CELL_SIZE;
      const y = tile.startRow * CELL_SIZE;
      const width = (tile.endCol - tile.startCol) * CELL_SIZE;
      const height = (tile.endRow - tile.startRow) * CELL_SIZE;
      ctx.fillStyle = "rgba(79, 66, 55, 0.48)";
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = "#fffdf8";
      ctx.font = `${Math.max(18, 30 / transform.scale)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✓", x + width / 2, y + height / 2);
    }
  };

  const drawCrosshair = (ctx: CanvasRenderingContext2D, cell: NonNullable<SelectedCell>, rows: number, cols: number) => {
    const topLeft = gridToScreenPoint(cell.row, cell.col, transform, CELL_SIZE);
    const size = CELL_SIZE * transform.scale;
    ctx.save();
    ctx.fillStyle = "rgba(201, 162, 126, 0.16)";
    ctx.fillRect(topLeft.x, 0, size, viewport.height);
    ctx.fillRect(0, topLeft.y, viewport.width, size);
    ctx.strokeStyle = "#8c5e3b";
    ctx.lineWidth = 2;
    ctx.strokeRect(topLeft.x, topLeft.y, size, size);
    ctx.fillStyle = "rgba(63, 51, 42, 0.12)";
    ctx.strokeRect(transform.offsetX, transform.offsetY, cols * CELL_SIZE * transform.scale, rows * CELL_SIZE * transform.scale);
    ctx.restore();
  };

  return (
    <div className={craftMode ? "canvas-wrap craft-canvas-wrap" : "canvas-wrap"}>
      <div className="canvas-tools" aria-label="畫布檢視控制">
        <button type="button" onClick={() => zoomAtCenter(transform.scale + 0.2)}>放大</button>
        <button type="button" onClick={() => zoomAtCenter(transform.scale - 0.2)}>縮小</button>
        <button type="button" onClick={() => fitToBounds(0, 0, grid[0]?.length ?? 1, grid.length || 1)}>適合畫面</button>
        <button type="button" onClick={() => { setTransform({ scale: 1, offsetX: 24, offsetY: 24 }); setSelected(null); }}>重置位置</button>
        <span className="canvas-hint">手機可單指拖曳檢視，雙指縮放。</span>
      </div>
      <div className="pattern-workspace">
        <div className="pattern-corner" />
        <canvas ref={topRulerRef} className="bf-coordinate-ruler top-ruler-canvas" aria-hidden="true" />
        <canvas ref={leftRulerRef} className="bf-coordinate-ruler left-ruler-canvas" aria-hidden="true" />
        <div className="bf-pattern-viewport">
          <canvas
            ref={contentRef}
            className="pattern-canvas pattern-content-canvas"
            onWheel={(event) => {
              event.preventDefault();
              zoomAtCenter(transform.scale + (event.deltaY > 0 ? -0.12 : 0.12));
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
              const hit = cellAt(event.clientX, event.clientY);
              if (hit) setSelected(hit);
              if (pointers.current.size === 2) {
                gesture.current = createGesture(Array.from(pointers.current.values()), transform);
                return;
              }
              if (EDIT_DRAG_TOOLS.includes(activeTool) && !craftMode) runActionAt(event.clientX, event.clientY, activeTool);
            }}
            onPointerMove={(event) => {
              event.preventDefault();
              const nextPoint = toPoint(event);
              if (!pointers.current.has(event.pointerId)) return;
              pointers.current.set(event.pointerId, nextPoint);
              const points = Array.from(pointers.current.values());
              if (points.length >= 2) {
                if (!gesture.current) gesture.current = createGesture(points, transform);
                const currentGesture = gesture.current;
                if (!currentGesture) return;
                const center = midpoint(points[0], points[1]);
                const scale = clamp(currentGesture.startScale * (distance(points[0], points[1]) / Math.max(currentGesture.startDistance, 1)), 0.25, 5);
                setTransform({
                  scale,
                  offsetX: center.x - currentGesture.worldCenter.x * scale,
                  offsetY: center.y - currentGesture.worldCenter.y * scale
                });
                moved.current = true;
                return;
              }
              scheduleSelectedCell(event.clientX, event.clientY);
              const start = pointerStart.current;
              if (start && distance(start, nextPoint) > 5) moved.current = true;
              if (EDIT_DRAG_TOOLS.includes(activeTool) && !craftMode) {
                runActionAt(event.clientX, event.clientY, activeTool);
                return;
              }
              const last = lastPanPoint.current;
              if (last) setTransform((value) => ({ ...value, offsetX: value.offsetX + event.clientX - last.clientX, offsetY: value.offsetY + event.clientY - last.clientY }));
              lastPanPoint.current = nextPoint;
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              if ((TAP_TOOLS.includes(activeTool) || craftMode) && pointers.current.size === 1 && !moved.current) runActionAt(event.clientX, event.clientY, activeTool);
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
          <CoordinateHud cell={selectedCell} cellData={selectedCellData} completed={selectedCell ? Boolean(completedSet.has(tileForCell(selectedCell.row, selectedCell.col, boardLayout)?.id ?? "")) : false} />
        </div>
      </div>
    </div>
  );

  function scheduleSelectedCell(clientX: number, clientY: number) {
    if (rafCell.current) window.cancelAnimationFrame(rafCell.current);
    rafCell.current = window.requestAnimationFrame(() => {
      const hit = cellAt(clientX, clientY);
      if (hit) setSelected(hit);
    });
  }
}

function CoordinateHud({ cell, cellData, completed }: { cell: SelectedCell; cellData: PatternGrid[number][number] | null; completed: boolean }) {
  if (!cell || !cellData) {
    return <div className="bf-coordinate-hud">點擊格子查看座標</div>;
  }
  const empty = isEmptyOrTransparentCell(cellData);
  return (
    <div className="bf-coordinate-hud">
      <strong>目前位置：第 {cell.col + 1} 欄 / 第 {cell.row + 1} 列</strong>
      <span>色號：{empty ? "透明 / 空白" : cellData.colorCode}</span>
      <span>狀態：{completed || cellData.done ? "已完成" : "未完成"}</span>
    </div>
  );
}

function drawEmptyCell(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number) {
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(x, y, cell, cell);
  ctx.fillStyle = "#efe4d8";
  ctx.fillRect(x, y, cell / 2, cell / 2);
  ctx.fillRect(x + cell / 2, y + cell / 2, cell / 2, cell / 2);
}

function drawBeadCell(ctx: CanvasRenderingContext2D, hex: string, x: number, y: number, cell: number) {
  const cx = x + cell / 2;
  const cy = y + cell / 2;
  const radius = cell * 0.43;
  const holeRadius = cell * 0.13;
  ctx.save();
  ctx.fillStyle = "rgba(63, 51, 42, 0.18)";
  ctx.beginPath();
  ctx.ellipse(cx + cell * 0.04, cy + cell * 0.06, radius, radius * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.arc(cx - radius * 0.28, cy - radius * 0.28, radius * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(63, 51, 42, 0.24)";
  ctx.beginPath();
  ctx.arc(cx, cy, holeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,253,248,0.28)";
  ctx.beginPath();
  ctx.arc(cx, cy, holeRadius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function setupCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(width * ratio));
  canvas.height = Math.max(1, Math.floor(height * ratio));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return ctx;
}

function toPoint(event: PointerEvent<HTMLCanvasElement>): PointerPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top, clientX: event.clientX, clientY: event.clientY };
}

function createGesture(points: PointerPoint[], transform: ViewTransform): GestureState | null {
  if (points.length < 2) return null;
  const center = midpoint(points[0], points[1]);
  return {
    startDistance: distance(points[0], points[1]),
    startScale: transform.scale,
    worldCenter: {
      x: (center.x - transform.offsetX) / transform.scale,
      y: (center.y - transform.offsetY) / transform.scale
    }
  };
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
