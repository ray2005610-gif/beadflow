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

export type Oklab = {
  l: number;
  a: number;
  b: number;
};

export type ColorMatchMode = "natural" | "vivid" | "soft" | "contrast";

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
export function deltaE2000(a: Lab, b: Lab): number {
  const deg2rad = Math.PI / 180;
  const rad2deg = 180 / Math.PI;
  const avgLp = (a.l + b.l) / 2;
  const c1 = Math.hypot(a.a, a.b);
  const c2 = Math.hypot(b.a, b.b);
  const avgC = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));
  const a1p = (1 + g) * a.a;
  const a2p = (1 + g) * b.a;
  const c1p = Math.hypot(a1p, a.b);
  const c2p = Math.hypot(a2p, b.b);
  const avgCp = (c1p + c2p) / 2;
  const h1p = normalizeHue(Math.atan2(a.b, a1p) * rad2deg);
  const h2p = normalizeHue(Math.atan2(b.b, a2p) * rad2deg);
  const dLp = b.l - a.l;
  const dCp = c2p - c1p;
  let dhp = h2p - h1p;
  if (c1p * c2p === 0) dhp = 0;
  else if (dhp > 180) dhp -= 360;
  else if (dhp < -180) dhp += 360;
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp / 2) * deg2rad);
  let avgHp = h1p + h2p;
  if (c1p * c2p === 0) avgHp = h1p + h2p;
  else if (Math.abs(h1p - h2p) > 180) avgHp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  else avgHp = (h1p + h2p) / 2;
  const t = 1 - 0.17 * Math.cos((avgHp - 30) * deg2rad) + 0.24 * Math.cos(2 * avgHp * deg2rad) + 0.32 * Math.cos((3 * avgHp + 6) * deg2rad) - 0.2 * Math.cos((4 * avgHp - 63) * deg2rad);
  const deltaTheta = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
  const rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
  const sl = 1 + (0.015 * Math.pow(avgLp - 50, 2)) / Math.sqrt(20 + Math.pow(avgLp - 50, 2));
  const sc = 1 + 0.045 * avgCp;
  const sh = 1 + 0.015 * avgCp * t;
  const rt = -Math.sin(2 * deltaTheta * deg2rad) * rc;
  return Math.sqrt(
    Math.pow(dLp / sl, 2) +
    Math.pow(dCp / sc, 2) +
    Math.pow(dHp / sh, 2) +
    rt * (dCp / sc) * (dHp / sh)
  );
}

function normalizeHue(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function rgbToOklab(rgb: RGB): Oklab {
  const linear = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  const r = linear(rgb.r);
  const g = linear(rgb.g);
  const b = linear(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  };
}

export function oklabDistance(a: Oklab, b: Oklab): number {
  return Math.hypot((a.l - b.l) * 1.35, a.a - b.a, a.b - b.b) * 100;
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

export function findClosestBeadColorWithDebug(rgb: RGB, palette: BeadColor[], mode: ColorMatchMode = "natural") {
  const sourceHsl = rgbToHsl(rgb);
  const sourceSaturation = sourceHsl.s;
  const sourceLab = rgbToLab(rgb);
  const sourceOklab = rgbToOklab(rgb);
  const ranked = palette.map((color) => {
    const targetRgb = hexToRgb(color.hex);
    const targetHsl = rgbToHsl(targetRgb);
    const saturation = targetHsl.s;
    const targetLab = rgbToLab(targetRgb);
    const targetOklab = rgbToOklab(targetRgb);
    const distance = colorDistance(rgb, targetRgb);
    const deltaE = deltaE76(sourceLab, targetLab);
    const deltaE2k = deltaE2000(sourceLab, targetLab);
    const okDistance = oklabDistance(sourceOklab, targetOklab);
    const weights = modeWeights(mode);
    const huePenalty = sourceSaturation > 0.13 && saturation > 0.1 ? hueDistance(sourceHsl.h, targetHsl.h) * weights.hue : 0;
    const grayPenalty = sourceSaturation > 0.13 && saturation < 0.09 ? weights.gray : 0;
    const colorPenalty = sourceSaturation < 0.1 && saturation > 0.24 ? 24 : 0;
    const saturationPenalty = Math.abs(sourceSaturation - saturation) * weights.saturation;
    const lightnessPenalty = Math.abs(sourceHsl.l - targetHsl.l) * weights.lightness;
    const familyPenalty = colorFamilyPenalty(sourceHsl, targetHsl) * weights.family;
    const priorityPenalty = color.priorityPenalty ?? 0;
    const adjustedDistance = okDistance * 0.7 + deltaE2k * 1.15 + deltaE * 0.18 + huePenalty + grayPenalty + colorPenalty + saturationPenalty + lightnessPenalty + familyPenalty + priorityPenalty;
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

function modeWeights(mode: ColorMatchMode) {
  if (mode === "vivid") return { hue: 135, gray: 66, saturation: 52, lightness: 22, family: 1.12 };
  if (mode === "soft") return { hue: 105, gray: 42, saturation: 30, lightness: 36, family: 0.92 };
  if (mode === "contrast") return { hue: 118, gray: 52, saturation: 40, lightness: 44, family: 1 };
  return { hue: 125, gray: 58, saturation: 44, lightness: 30, family: 1 };
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


