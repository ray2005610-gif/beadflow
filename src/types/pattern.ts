export type PatternCell = {
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
