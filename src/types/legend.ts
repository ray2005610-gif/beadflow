export type LegendRegion = { x: number; y: number; width: number; height: number; label: string };
export type LegendEntry = {
  colorCode: string;
  expectedCount: number;
  swatchColor?: string;
  confidence: number;
  confirmed: boolean;
  source: "ocr" | "manual";
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
};
