export type RGB = {
  r: number;
  g: number;
  b: number;
};

export type BeadColor = {
  code: string;
  name: string;
  hex: string;
  symbol: string;
  series?: string;
  brand?: string;
  paletteVersion?: string;
  nameZh?: string;
  nameEn?: string;
  finish?: "solid" | "pearl" | "transparent" | "neon" | "glitter" | "special" | "unknown";
  isTransparent?: boolean;
  isPearl?: boolean;
  isNeon?: boolean;
  isGlitter?: boolean;
  isSpecial?: boolean;
  isStandard?: boolean;
  isExtended?: boolean;
  defaultUseInMatching?: boolean;
  defaultUseInRecognition?: boolean;
  defaultUseInAutoMatching?: boolean;
  canUseManually?: boolean;
  specialLabel?: string;
  priorityPenalty?: number;
  source?: string;
  sourceUrl?: string;
  sourceNote?: string;
};
