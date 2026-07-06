export type GridCropRange = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

export type GridCalibration = {
  imageWidth: number;
  imageHeight: number;
  selectionX: number;
  selectionY: number;
  selectionWidth: number;
  selectionHeight: number;
  cellWidth: number;
  cellHeight: number;
  originX: number;
  originY: number;
  columns: number;
  rows: number;
  rotation: number;
  cropRange?: GridCropRange;
};

export type GridRecognitionOptions = {
  sampleMode: "center" | "averageCenterArea" | "ringSample" | "symbolAware";
  ignoreGridLines: boolean;
  centerSampleRatio: number;
  confidenceThreshold: number;
};
