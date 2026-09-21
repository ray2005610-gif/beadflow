export type LegendRegion = { x: number; y: number; width: number; height: number; label: string };
export type LegendEntry = {
  colorCode: string;
  expectedCount: number;
  sampledColor?: string;
  swatchColor?: string;
  confidence: number;
  confirmed: boolean;
  source: "ocr" | "manual";
};
export type GridRecognitionMode = "legend-driven" | "image-driven";
export type GridTextEvidence = {
  sourceRow: number;
  sourceCol: number;
  textCandidate: string;
  textConfidence: number;
};
export type LegendAssignmentSummary = {
  mode: GridRecognitionMode;
  expectedTotal: number;
  detectedValidCells: number;
  difference: number;
  totalsMatch: boolean;
  constraintApplied: boolean;
  lowConfidenceCount: number;
};
export type GridRecognitionResult = {
  grid: import("./pattern").PatternGrid;
  recognitionMode: GridRecognitionMode;
  assignmentSummary?: LegendAssignmentSummary;
};
export type CellSuggestion = {
  row: number; col: number; from: string; to: string;
  currentDistance: number; alternativeDistance: number;
  safe: boolean;
};
export type ValidationResult = {
  expectedTotal: number; detectedTotal: number;
  entries: Array<LegendEntry & { detectedCount: number; difference: number }>;
  unexpected: Array<{ colorCode: string; detectedCount: number }>;
  suspiciousCells: CellSuggestion[];
  assignment?: LegendAssignmentSummary;
};
