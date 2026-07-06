import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { GridCalibration } from "../types/calibration";
import { canvasToWorld, clamp } from "../utils/canvasMath";
import { loadImage } from "../utils/imageToPattern";

type Point = { x: number; y: number };
type PointerPoint = Point & { clientX: number; clientY: number };
type InteractionMode = "select" | "pan";
type GestureState = {
  startDistance: number;
  startZoom: number;
  worldCenter: Point;
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
  const selectStart = useRef<Point | null>(null);
  const lastPanPoint = useRef<PointerPoint | null>(null);
  const [mode, setMode] = useState<InteractionMode>("select");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 24, y: 24 });

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
    ctx.fillStyle = "#eef1f7";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    ctx.drawImage(image, 0, 0);
    if (calibration) drawCalibration(ctx, calibration);
    ctx.restore();
  }, [imageDataUrl, calibration, zoom, pan]);

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

  const updateSelection = (clientX: number, clientY: number) => {
    const image = imageRef.current;
    const start = selectStart.current;
    if (!image || !start) return;
    const now = worldAt(clientX, clientY);
    const x = clamp(Math.min(start.x, now.x), 0, image.naturalWidth);
    const y = clamp(Math.min(start.y, now.y), 0, image.naturalHeight);
    const w = clamp(Math.abs(now.x - start.x), 1, image.naturalWidth - x);
    const h = clamp(Math.abs(now.y - start.y), 1, image.naturalHeight - y);
    if (w < 6 || h < 6) return;
    const cellWidth = w / 3;
    const cellHeight = h / 3;
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

  return (
    <div className="canvas-wrap calibration-wrap">
      <div className="canvas-tools" aria-label="校準畫布控制">
        <button type="button" className={mode === "select" ? "active" : ""} onClick={() => setMode("select")}>框選 3×3</button>
        <button type="button" className={mode === "pan" ? "active" : ""} onClick={() => setMode("pan")}>拖曳/縮放</button>
        <button type="button" onClick={() => zoomAtCenter(zoom + 0.2)}>放大</button>
        <button type="button" onClick={() => zoomAtCenter(zoom - 0.2)}>縮小</button>
        <button type="button" onClick={() => { setZoom(1); setPan({ x: 24, y: 24 }); }}>重置視圖</button>
        <span className="canvas-hint">手機請先選「框選 3×3」拖出校準區；雙指可縮放。</span>
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
            selectStart.current = null;
            return;
          }
          selectStart.current = mode === "select" ? worldAt(event.clientX, event.clientY) : null;
        }}
        onPointerMove={(event) => {
          event.preventDefault();
          const point = toPoint(event);
          if (!pointers.current.has(event.pointerId)) return;
          pointers.current.set(event.pointerId, point);
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

          if (mode === "select" && selectStart.current) {
            updateSelection(event.clientX, event.clientY);
            return;
          }

          const last = lastPanPoint.current;
          if (last) {
            setPan((value) => ({ x: value.x + event.clientX - last.clientX, y: value.y + event.clientY - last.clientY }));
          }
          lastPanPoint.current = point;
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          pointers.current.delete(event.pointerId);
          gesture.current = null;
          selectStart.current = null;
          lastPanPoint.current = null;
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          gesture.current = null;
          selectStart.current = null;
          lastPanPoint.current = null;
        }}
      />
    </div>
  );
}

function drawCalibration(ctx: CanvasRenderingContext2D, calibration: GridCalibration) {
  ctx.save();
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2;
  ctx.strokeRect(calibration.selectionX, calibration.selectionY, calibration.selectionWidth, calibration.selectionHeight);
  ctx.strokeStyle = "rgba(17,24,39,0.7)";
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
    ctx.fillStyle = "rgba(36,84,214,0.08)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
  }
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
