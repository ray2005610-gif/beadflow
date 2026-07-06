import { useEffect, useRef, useState } from "react";
import type { GridCalibration } from "../types/calibration";
import { canvasToWorld, clamp } from "../utils/canvasMath";
import { loadImage } from "../utils/imageToPattern";

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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [dragging, setDragging] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const start = useRef({ x: 0, y: 0 });
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => {
    loadImage(imageDataUrl).then((image) => {
      imageRef.current = image;
      if (!calibration) {
        const columns = Math.max(1, Math.floor((image.naturalWidth - 20) / 30));
        const rows = Math.max(1, Math.floor((image.naturalHeight - 20) / 30));
        onCalibrationChange({
          imageWidth: image.naturalWidth,
          imageHeight: image.naturalHeight,
          selectionX: 20,
          selectionY: 20,
          selectionWidth: Math.min(90, image.naturalWidth / 3),
          selectionHeight: Math.min(90, image.naturalHeight / 3),
          cellWidth: Math.min(90, image.naturalWidth / 3) / 3,
          cellHeight: Math.min(90, image.naturalHeight / 3) / 3,
          originX: 20,
          originY: 20,
          columns,
          rows,
          rotation: 0,
          cropRange: { startRow: 0, endRow: rows - 1, startCol: 0, endCol: columns - 1 }
        });
      }
    });
  }, [imageDataUrl, calibration, onCalibrationChange]);

  useEffect(() => {
    const canvas = ref.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * window.devicePixelRatio);
    canvas.height = Math.floor(rect.height * window.devicePixelRatio);
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
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

  return (
    <canvas
      ref={ref}
      className="calibration-canvas"
      onWheel={(event) => {
        event.preventDefault();
        setZoom((value) => clamp(value + (event.deltaY > 0 ? -0.08 : 0.08), 0.2, 5));
      }}
      onPointerDown={(event) => {
        (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
        last.current = { x: event.clientX, y: event.clientY };
        if (event.shiftKey || event.button === 1) {
          setDragging(true);
          return;
        }
        const world = worldAt(event.clientX, event.clientY);
        start.current = world;
        setSelecting(true);
      }}
      onPointerMove={(event) => {
        if (dragging) {
          setPan((value) => ({ x: value.x + event.clientX - last.current.x, y: value.y + event.clientY - last.current.y }));
          last.current = { x: event.clientX, y: event.clientY };
        }
        if (selecting) {
          const image = imageRef.current;
          if (!image) return;
          const now = worldAt(event.clientX, event.clientY);
          const x = Math.min(start.current.x, now.x);
          const y = Math.min(start.current.y, now.y);
          const w = Math.abs(now.x - start.current.x);
          const h = Math.abs(now.y - start.current.y);
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
        }
      }}
      onPointerUp={() => {
        setDragging(false);
        setSelecting(false);
      }}
      onPointerCancel={() => {
        setDragging(false);
        setSelecting(false);
      }}
    />
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
