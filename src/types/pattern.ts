export type PatternCell = {
  rawDetectedColor?: string;
  finalDetectedColor?: string;
  suspectedMismatch?: boolean;
  correctionReason?: "neighbor" | "legend" | "manual";
  validationConfirmed?: boolean;
  row: number;
  col: number;
  colorCode: string;
  colorName: string;
  hex: string;
  symbol: string;
  done: boolean;
  empty?: boolean;
  rawRgb?: {
    r: number;
    g: number;
    b: number;
  };
  sampledColor?: { r: number; g: number; b: number };
  textCandidate?: string;
  textConfidence?: number;
  bestColorCost?: number;
  secondBestColorCost?: number;
  assignedColorCost?: number;
  candidateMargin?: number;
  rawHex?: string;
  alpha?: number;
  confidence?: number;
  distance?: number;
  adjustedDistance?: number;
  candidates?: Array<{
    code: string;
    hex: string;
    distance: number;
    adjustedDistance?: number;
    saturation?: number;
    hue?: number;
    lightness?: number;
    colorCost?: number;
    textCost?: number;
    totalCost?: number;
  }>;
  rawHue?: number;
  rawSaturation?: number;
  rawLightness?: number;
  matchedHex?: string;
  backgroundReason?: string;
  sourceRow?: number;
  sourceCol?: number;
};

export type PatternGrid = PatternCell[][];

export type PatternSize = {
  width: number;
  height: number;
};

export type ColorStat = {
  code: string;
  name: string;
  hex: string;
  symbol: string;
  total: number;
  done: number;
  remaining: number;
  percent: number;
};
