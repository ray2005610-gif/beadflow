import type { PatternGrid, PatternSize } from "./pattern";

export type PatternSourceType =
  | "grid_recognition"
  | "manual_drawing"
  | "photo_to_pattern";

export type PatternStatus =
  | "draft"
  | "todo"
  | "in_progress"
  | "done"
  | "exported"
  | "stock_out_done";

export type PatternProject = {
  id: string;
  name: string;
  sourceType: PatternSourceType;
  size: PatternSize;
  grid: PatternGrid;
  originalImageDataUrl?: string;
  createdAt: string;
  updatedAt: string;
  status: PatternStatus;
  tags: string[];
};
