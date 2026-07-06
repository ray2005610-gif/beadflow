export type ViewTransform = {
  zoom: number;
  panX: number;
  panY: number;
};

export function canvasToWorld(x: number, y: number, transform: ViewTransform) {
  return {
    x: (x - transform.panX) / transform.zoom,
    y: (y - transform.panY) / transform.zoom
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function cellFromPoint(x: number, y: number, cellSize: number) {
  return {
    col: Math.floor(x / cellSize),
    row: Math.floor(y / cellSize)
  };
}
