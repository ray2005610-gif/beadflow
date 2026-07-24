import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { GridCalibration } from "../types/calibration";
import { canvasToWorld, clamp } from "../utils/canvasMath";
import { loadImage } from "../utils/imageToPattern";

type Point = { x: number; y: number };
type PointerPoint = Point & { clientX: number; clientY: number };
type InteractionMode = "select-3x3" | "pan";
type GestureState = {
  startDistance: number;
  startZoom: number;
  worldCenter: Point;
};
type Preview3x3 = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  centerRow: number;
  centerCol: number;
};

export function GridCalibrationCanvas({
  imageDataUrl,
  calibration,
  onCalibrationChange
}: {
  imageDataUrl: string;
  calibration: GridCalibration | null;
  onCalibrationChange: (calibration: GridCalibration) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const pointers = useRef(new Map<number, PointerPoint>());
  const gesture = useRef<GestureState | null>(null);
  const lastPanPoint = useRef<PointerPoint | null>(null);
  const [mode, setMode] = useState<InteractionMode>("select-3x3");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [preview3x3, setPreview3x3] = useState<Preview3x3 | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadImage(imageDataUrl).then((image) => {
      if (cancelled) return;
      imageRef.current = image;
      if (!calibration) {
        const estimatedCell = Math.max(8, Math.min(32, Math.min(image.naturalWidth, image.naturalHeight) / 40));
        const columns = Math.max(1, Math.min(120, Math.floor((image.naturalWidth - 20) / estimatedCell)));
        const rows = Math.max(1, Math.min(120, Math.floor((image.naturalHeight - 20) / estimatedCell)));
        onCalibrationChange({
          imageWidth: image.naturalWidth,
          imageHeight: image.naturalHeight,
          selectionX: 20,
          selectionY: 20,
          selectionWidth: estimatedCell * 3,
          selectionHeight: estimatedCell * 3,
          cellWidth: estimatedCell,
          cellHeight: estimatedCell,
          originX: 20,
          originY: 20,
          columns,
          rows,
          rotation: 0,
          cropRange: { startRow: 0, endRow: rows - 1, startCol: 0, endCol: columns - 1 }
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [imageDataUrl, calibration, onCalibrationChange]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview3x3(null);
      if (event.key === "Enter" && mode === "select-3x3") applyPreview3x3();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    const canvas = ref.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#f3eadf";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    ctx.drawImage(image, 0, 0);
    if (calibration) {
      drawCalibration(ctx, calibration);
      if (mode === "select-3x3" && preview3x3) draw3x3Preview(ctx, calibration, preview3x3);
    }
    ctx.restore();
  }, [imageDataUrl, calibration, zoom, pan, mode, preview3x3]);

  const worldAt = (clientX: number, clientY: number) => {
    const canvas = ref.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return canvasToWorld(clientX - rect.left, clientY - rect.top, { zoom, panX: pan.x, panY: pan.y });
  };

  const zoomAtCenter = (nextZoom: number) => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const center = { x: rect.width / 2, y: rect.height / 2 };
    const worldCenter = canvasToWorld(center.x, center.y, { zoom, panX: pan.x, panY: pan.y });
    const clamped = clamp(nextZoom, 0.2, 6);
    setZoom(clamped);
    setPan({ x: center.x - worldCenter.x * clamped, y: center.y - worldCenter.y * clamped });
  };

  const updatePreview3x3 = (clientX: number, clientY: number) => {
    const next = get3x3Preview(clientX, clientY);
    if (next) setPreview3x3(next);
  };

  const applyPreview3x3 = () => {
    const image = imageRef.current;
    if (!image || !calibration || !preview3x3) return;
    const selectedCols = preview3x3.endCol - preview3x3.startCol + 1;
    const selectedRows = preview3x3.endRow - preview3x3.startRow + 1;
    const x = calibration.originX + preview3x3.startCol * calibration.cellWidth;
    const y = calibration.originY + preview3x3.startRow * calibration.cellHeight;
    const w = selectedCols * calibration.cellWidth;
    const h = selectedRows * calibration.cellHeight;
    const cellWidth = w / selectedCols;
    const cellHeight = h / selectedRows;
    const columns = Math.max(1, Math.min(120, Math.floor((image.naturalWidth - x) / cellWidth)));
    const rows = Math.max(1, Math.min(120, Math.floor((image.naturalHeight - y) / cellHeight)));
    onCalibrationChange({
      imageWidth: image.naturalWidth,
      imageHeight: image.naturalHeight,
      selectionX: x,
      selectionY: y,
      selectionWidth: w,
      selectionHeight: h,
      cellWidth,
      cellHeight,
      originX: x,
      originY: y,
      columns,
      rows,
      rotation: 0,
      cropRange: { startRow: 0, endRow: rows - 1, startCol: 0, endCol: columns - 1 }
    });
  };

  const get3x3Preview = (clientX: number, clientY: number): Preview3x3 | null => {
    if (!calibration) return null;
    const world = worldAt(clientX, clientY);
    const rawCol = Math.floor((world.x - calibration.originX) / calibration.cellWidth);
    const rawRow = Math.floor((world.y - calibration.originY) / calibration.cellHeight);
    if (!Number.isFinite(rawCol) || !Number.isFinite(rawRow)) return null;
    const centerCol = Math.max(0, Math.min(calibration.columns - 1, rawCol));
    const centerRow = Math.max(0, Math.min(calibration.rows - 1, rawRow));
    const spanCols = Math.min(3, calibration.columns);
    const spanRows = Math.min(3, calibration.rows);
    const startCol = Math.max(0, Math.min(calibration.columns - spanCols, centerCol - 1));
    const startRow = Math.max(0, Math.min(calibration.rows - spanRows, centerRow - 1));
    return {
      startRow,
      endRow: startRow + spanRows - 1,
      startCol,
      endCol: startCol + spanCols - 1,
      centerRow,
      centerCol
    };
  };

  return (
    <div className="canvas-wrap calibration-wrap">
      <div className="canvas-tools" aria-label="校正畫布工具">
        <button type="button" className={mode === "select-3x3" ? "active" : ""} onClick={() => setMode("select-3x3")}>3×3 中心選取</button>
        <button type="button" className={mode === "pan" ? "active" : ""} onClick={() => setMode("pan")}>拖曳 / 縮放</button>
        <button type="button" onClick={() => zoomAtCenter(zoom + 0.2)}>放大</button>
        <button type="button" onClick={() => zoomAtCenter(zoom - 0.2)}>縮小</button>
        <button type="button" onClick={() => { setZoom(1); setPan({ x: 24, y: 24 }); }}>重設視圖</button>
        {preview3x3 && <button type="button" onClick={applyPreview3x3}>確認 3×3</button>}
        {preview3x3 && <button type="button" onClick={() => setPreview3x3(null)}>取消</button>}
        {preview3x3 && <span className="canvas-hint">中心：第 {preview3x3.centerRow + 1} 列，第 {preview3x3.centerCol + 1} 欄；範圍：{preview3x3.startRow + 1}-{preview3x3.endRow + 1} 列 / {preview3x3.startCol + 1}-{preview3x3.endCol + 1} 欄</span>}
        {!preview3x3 && <span className="canvas-hint">移到格子上會以該格為中心預覽 3×3；桌機點擊套用，手機可按確認 3×3。</span>}
      </div>
      <canvas
        ref={ref}
        className="calibration-canvas"
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
          lastPanPoint.current = point;
          if (pointers.current.size === 2) {
            gesture.current = createGesture(Array.from(pointers.current.values()), zoom, pan, ref.current);
            return;
          }
          if (mode === "select-3x3") updatePreview3x3(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          event.preventDefault();
          const point = toPoint(event);
          if (!pointers.current.has(event.pointerId) && event.pointerType !== "mouse") return;
          if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, point);
          const points = Array.from(pointers.current.values());

          if (points.length >= 2) {
            if (!gesture.current) gesture.current = createGesture(points, zoom, pan, ref.current);
            const currentGesture = gesture.current;
            if (!currentGesture) return;
            const center = midpoint(points[0], points[1]);
            const scale = distance(points[0], points[1]) / Math.max(currentGesture.startDistance, 1);
            const nextZoom = clamp(currentGesture.startZoom * scale, 0.2, 6);
            setZoom(nextZoom);
            setPan({
              x: center.x - currentGesture.worldCenter.x * nextZoom,
              y: center.y - currentGesture.worldCenter.y * nextZoom
            });
            return;
          }

          if (mode === "select-3x3") {
            updatePreview3x3(event.clientX, event.clientY);
            return;
          }

          const last = lastPanPoint.current;
          if (last && pointers.current.has(event.pointerId)) {
            setPan((value) => ({ x: value.x + event.clientX - last.clientX, y: value.y + event.clientY - last.clientY }));
          }
          lastPanPoint.current = point;
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          pointers.current.delete(event.pointerId);
          gesture.current = null;
          lastPanPoint.current = null;
          if (mode === "select-3x3" && event.pointerType === "mouse") applyPreview3x3();
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          gesture.current = null;
          lastPanPoint.current = null;
        }}
      />
    </div>
  );
}

function drawCalibration(ctx: CanvasRenderingContext2D, calibration: GridCalibration) {
  ctx.save();
  ctx.strokeStyle = "#B98C62";
  ctx.lineWidth = 2;
  ctx.strokeRect(calibration.selectionX, calibration.selectionY, calibration.selectionWidth, calibration.selectionHeight);
  ctx.strokeStyle = "rgba(63,51,42,0.68)";
  for (let c = 0; c <= calibration.columns; c += 1) {
    ctx.lineWidth = c % 10 === 0 ? 2 : c % 5 === 0 ? 1.3 : 0.55;
    const x = calibration.originX + c * calibration.cellWidth;
    ctx.beginPath();
    ctx.moveTo(x, calibration.originY);
    ctx.lineTo(x, calibration.originY + calibration.rows * calibration.cellHeight);
    ctx.stroke();
  }
  for (let r = 0; r <= calibration.rows; r += 1) {
    ctx.lineWidth = r % 10 === 0 ? 2 : r % 5 === 0 ? 1.3 : 0.55;
    const y = calibration.originY + r * calibration.cellHeight;
    ctx.beginPath();
    ctx.moveTo(calibration.originX, y);
    ctx.lineTo(calibration.originX + calibration.columns * calibration.cellWidth, y);
    ctx.stroke();
  }
  const crop = calibration.cropRange;
  if (crop) {
    const x = calibration.originX + crop.startCol * calibration.cellWidth;
    const y = calibration.originY + crop.startRow * calibration.cellHeight;
    const w = (crop.endCol - crop.startCol + 1) * calibration.cellWidth;
    const h = (crop.endRow - crop.startRow + 1) * calibration.cellHeight;
    ctx.fillStyle = "rgba(185,140,98,0.08)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#A8754F";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
  }
  ctx.restore();
}

function draw3x3Preview(ctx: CanvasRenderingContext2D, calibration: GridCalibration, preview: Preview3x3) {
  const x = calibration.originX + preview.startCol * calibration.cellWidth;
  const y = calibration.originY + preview.startRow * calibration.cellHeight;
  const w = (preview.endCol - preview.startCol + 1) * calibration.cellWidth;
  const h = (preview.endRow - preview.startRow + 1) * calibration.cellHeight;
  const centerX = calibration.originX + preview.centerCol * calibration.cellWidth;
  const centerY = calibration.originY + preview.centerRow * calibration.cellHeight;

  ctx.save();
  ctx.fillStyle = "rgba(201,162,126,0.2)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#8B5E3C";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,253,248,0.38)";
  ctx.fillRect(centerX, centerY, calibration.cellWidth, calibration.cellHeight);
  ctx.strokeStyle = "#5F432F";
  ctx.lineWidth = 2;
  ctx.strokeRect(centerX, centerY, calibration.cellWidth, calibration.cellHeight);
  ctx.fillStyle = "#5F432F";
  ctx.font = `${Math.max(12, calibration.cellHeight * 0.45)}px sans-serif`;
  ctx.fillText("3×3", x + 6, Math.max(y + 16, y + h - 6));
  ctx.restore();
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
