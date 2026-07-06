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
  const ranked = palette.map((color) => {
    const targetRgb = hexToRgb(color.hex);
    const targetHsl = rgbToHsl(targetRgb);
    const saturation = targetHsl.s;
    const distance = colorDistance(rgb, targetRgb);
    const huePenalty = sourceSaturation > 0.18 && saturation > 0.12 ? hueDistance(sourceHsl.h, targetHsl.h) * 95 : 0;
    const grayPenalty = sourceSaturation > 0.18 && saturation < 0.08 ? 42 : 0;
    const oversaturatedPenalty = sourceSaturation < 0.12 && saturation > 0.35 ? 24 : 0;
    const saturationPenalty = Math.abs(sourceSaturation - saturation) * (sourceSaturation > 0.18 ? 28 : 12);
    const mismatchPenalty =
      sourceSaturation > 0.18 && saturation < 0.08 ? 1.25 :
      sourceSaturation < 0.12 && saturation > 0.35 ? 1.15 :
      1;
    const adjustedDistance = distance * mismatchPenalty + huePenalty + grayPenalty + oversaturatedPenalty + saturationPenalty;
    return {
      color,
      code: color.code,
      hex: color.hex,
      distance,
      adjustedDistance,
      saturation,
      hue: targetHsl.h
    };
  }).sort((a, b) => a.adjustedDistance - b.adjustedDistance);
  const best = ranked[0];
  const confidence = Math.max(0, Math.min(1, 1 - best.adjustedDistance / 180));
  return {
    color: best.color,
    distance: best.distance,
    adjustedDistance: best.adjustedDistance,
    confidence,
    rawHue: sourceHsl.h,
    rawSaturation: sourceSaturation,
    candidates: ranked.slice(0, 5).map(({ code, hex, distance, adjustedDistance, saturation, hue }) => ({
      code,
      hex,
      distance,
      adjustedDistance,
      saturation,
      hue
    }))
  };
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
