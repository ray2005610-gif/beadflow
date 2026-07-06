import type { BeadColor, RGB } from "../types/bead";

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  const value = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function rgbToHex(rgb: RGB): string {
  const part = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`.toUpperCase();
}

export function colorDistance(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11);
}

export type Lab = {
  l: number;
  a: number;
  b: number;
};

export function rgbToLab(rgb: RGB): Lab {
  const pivotRgb = (value: number) => {
    const normalized = value / 255;
    return normalized > 0.04045 ? Math.pow((normalized + 0.055) / 1.055, 2.4) : normalized / 12.92;
  };
  const r = pivotRgb(rgb.r);
  const g = pivotRgb(rgb.g);
  const b = pivotRgb(rgb.b);
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) / 1;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const pivotXyz = (value: number) => value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  const fx = pivotXyz(x);
  const fy = pivotXyz(y);
  const fz = pivotXyz(z);
  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
}

export function deltaE76(a: Lab, b: Lab): number {
  return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
}

export function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 1 - diff);
}

export function rgbToHsl(rgb: RGB) {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  if (max === g) h = (b - r) / d + 2;
  if (max === b) h = (r - g) / d + 4;
  return { h: h / 6, s, l };
}

export function isNearWhite(rgb: RGB, threshold = 245): boolean {
  return rgb.r >= threshold && rgb.g >= threshold && rgb.b >= threshold;
}

export function isNearRgb(a: RGB, b: RGB, tolerance: number): boolean {
  return Math.abs(a.r - b.r) <= tolerance && Math.abs(a.g - b.g) <= tolerance && Math.abs(a.b - b.b) <= tolerance;
}

export function findClosestBeadColor(rgb: RGB, palette: BeadColor[]) {
  return findClosestBeadColorWithDebug(rgb, palette);
}

export function findClosestBeadColorWithDebug(rgb: RGB, palette: BeadColor[]) {
  const sourceHsl = rgbToHsl(rgb);
  const sourceSaturation = sourceHsl.s;
  const sourceLab = rgbToLab(rgb);
  const ranked = palette.map((color) => {
    const targetRgb = hexToRgb(color.hex);
    const targetHsl = rgbToHsl(targetRgb);
    const saturation = targetHsl.s;
    const targetLab = rgbToLab(targetRgb);
    const distance = colorDistance(rgb, targetRgb);
    const deltaE = deltaE76(sourceLab, targetLab);
    const huePenalty = sourceSaturation > 0.14 && saturation > 0.1 ? hueDistance(sourceHsl.h, targetHsl.h) * 115 : 0;
    const grayPenalty = sourceSaturation > 0.14 && saturation < 0.09 ? 48 : 0;
    const colorPenalty = sourceSaturation < 0.1 && saturation > 0.24 ? 34 : 0;
    const saturationPenalty = Math.abs(sourceSaturation - saturation) * (sourceSaturation > 0.18 ? 42 : 18);
    const lightnessPenalty = Math.abs(sourceHsl.l - targetHsl.l) * 32;
    const familyPenalty = colorFamilyPenalty(sourceHsl, targetHsl);
    const adjustedDistance = deltaE + huePenalty + grayPenalty + colorPenalty + saturationPenalty + lightnessPenalty + familyPenalty;
    return {
      color,
      code: color.code,
      hex: color.hex,
      distance,
      deltaE,
      adjustedDistance,
      saturation,
      hue: targetHsl.h,
      lightness: targetHsl.l
    };
  }).sort((a, b) => a.adjustedDistance - b.adjustedDistance);
  const best = ranked[0];
  const confidence = Math.max(0, Math.min(1, 1 - best.adjustedDistance / 145));
  return {
    color: best.color,
    distance: best.distance,
    adjustedDistance: best.adjustedDistance,
    confidence,
    rawHue: sourceHsl.h,
    rawSaturation: sourceSaturation,
    rawLightness: sourceHsl.l,
    candidates: ranked.slice(0, 5).map(({ code, hex, distance, adjustedDistance, saturation, hue, lightness }) => ({
      code,
      hex,
      distance,
      adjustedDistance,
      saturation,
      hue,
      lightness
    }))
  };
}

function colorFamilyPenalty(source: ReturnType<typeof rgbToHsl>, target: ReturnType<typeof rgbToHsl>): number {
  if (source.s < 0.1 || target.s < 0.1) return 0;
  const sourceHue = source.h * 360;
  const targetHue = target.h * 360;
  const sourceIsOrangeBrown = sourceHue >= 15 && sourceHue <= 48;
  const targetIsYellowCream = targetHue >= 48 && targetHue <= 72;
  const sourceIsPinkRed = sourceHue >= 330 || sourceHue <= 18;
  const targetIsOrange = targetHue >= 20 && targetHue <= 45;
  const sourceIsGreen = sourceHue >= 70 && sourceHue <= 170;
  const targetIsGray = target.s < 0.14;
  let penalty = 0;
  if (sourceIsOrangeBrown && targetIsYellowCream && target.l > source.l + 0.08) penalty += 20;
  if (sourceIsPinkRed && targetIsOrange && source.s > 0.18) penalty += 16;
  if (sourceIsGreen && targetIsGray) penalty += 35;
  return penalty;
}

export function findClosestBeadColorLegacy(rgb: RGB, palette: BeadColor[]) {
  let best = palette[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const color of palette) {
    const distance = colorDistance(rgb, hexToRgb(color.hex));
    if (distance < bestDistance) {
      best = color;
      bestDistance = distance;
    }
  }
  const confidence = Math.max(0, Math.min(1, 1 - bestDistance / 180));
  return { color: best, distance: bestDistance, confidence };
}

export function textColorForBackground(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#111111" : "#ffffff";
}
