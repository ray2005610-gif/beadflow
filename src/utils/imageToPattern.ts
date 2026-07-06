import type { BeadColor, RGB } from "../types/bead";
import type { PatternCell, PatternGrid } from "../types/pattern";
import {
  colorDistance,
  findClosestBeadColorWithDebug,
  hexToRgb,
  isNearRgb,
  isNearWhite,
  rgbToHex,
  rgbToHsl,
  rgbToOklab,
  type ColorMatchMode
} from "./colorUtils";

export type PhotoColorMode = ColorMatchMode;

export type BackgroundRemovalOptions = {
  mode: "none" | "transparentOnly" | "auto" | "whiteBackground" | "checkerboard" | "pickedColor";
  removeTransparent: boolean;
  alphaThreshold: number;
  removeWhiteBackground: boolean;
  whiteThreshold: number;
  removeCheckerboardBackground: boolean;
  checkerboardTolerance: number;
  removeNearBackgroundColor: boolean;
  backgroundSampleColor?: string;
  backgroundTolerance: number;
  protectRealWhiteAndGray: boolean;
};

export type PhotoPatternOptions = {
  colorMode: PhotoColorMode;
  maxColors: number;
};

type SampledColor = RGB & { alpha: number };
type CellSample = {
  row: number;
  col: number;
  rgb: RGB;
  adjustedRgb: RGB;
  alpha: number;
  empty: boolean;
};

export const defaultBackgroundRemovalOptions: BackgroundRemovalOptions = {
  mode: "auto",
  removeTransparent: true,
  alphaThreshold: 20,
  removeWhiteBackground: false,
  whiteThreshold: 245,
  removeCheckerboardBackground: true,
  checkerboardTolerance: 18,
  removeNearBackgroundColor: false,
  backgroundSampleColor: undefined,
  backgroundTolerance: 28,
  protectRealWhiteAndGray: true
};

export function createBlankPattern(width: number, height: number, color: BeadColor): PatternGrid {
  return Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, col) => ({
      row,
      col,
      colorCode: color.code,
      colorName: color.name,
      hex: color.hex,
      symbol: color.symbol,
      done: false,
      empty: false
    }))
  );
}

export function createEmptyCell(row: number, col: number, rawRgb?: RGB, alpha?: number, sourceRow?: number, sourceCol?: number): PatternCell {
  return {
    row,
    col,
    colorCode: "",
    colorName: "空白",
    hex: "transparent",
    symbol: "",
    done: false,
    empty: true,
    rawRgb,
    rawHex: rawRgb ? rgbToHex(rawRgb) : undefined,
    alpha,
    sourceRow,
    sourceCol
  };
}

export async function imageToPattern(
  imageDataUrl: string,
  width: number,
  height: number,
  palette: BeadColor[],
  backgroundOptions: BackgroundRemovalOptions = defaultBackgroundRemovalOptions,
  photoOptions: PhotoPatternOptions = { colorMode: "natural", maxColors: 48 }
): Promise<PatternGrid> {
  const image = await loadImage(imageDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("無法建立圖片轉換畫布");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const rawSamples = sampleImageToCells(imageData, width, height);
  const backgroundMask = buildCellBackgroundMask(rawSamples, width, height, backgroundOptions);
  const cellSamples = rawSamples.map((sample, index): CellSample => {
    const row = Math.floor(index / width);
    const col = index % width;
    const rgb = { r: sample.r, g: sample.g, b: sample.b };
    return {
      row,
      col,
      rgb,
      adjustedRgb: adjustForMode(rgb, photoOptions.colorMode),
      alpha: sample.alpha,
      empty: backgroundMask[index]
    };
  });
  const paletteForImage = selectPaletteForImage(cellSamples, palette, photoOptions);
  const grid = Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, col) => {
      const sample = cellSamples[row * width + col];
      if (sample.empty) return createEmptyCell(row, col, sample.rgb, sample.alpha, row, col);
      const match = findClosestBeadColorWithDebug(sample.adjustedRgb, paletteForImage, photoOptions.colorMode);
      return {
        row,
        col,
        colorCode: match.color.code,
        colorName: match.color.name,
        hex: match.color.hex,
        symbol: match.color.symbol,
        done: false,
        empty: false,
        rawRgb: sample.rgb,
        rawHex: rgbToHex(sample.rgb),
        matchedHex: match.color.hex,
        alpha: sample.alpha,
        confidence: match.confidence,
        distance: match.distance,
        adjustedDistance: match.adjustedDistance,
        candidates: match.candidates,
        rawHue: match.rawHue,
        rawSaturation: match.rawSaturation,
        rawLightness: match.rawLightness,
        sourceRow: row,
        sourceCol: col
      };
    })
  );
  return smoothIsolatedCells(grid, paletteForImage);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("圖片載入失敗"));
    image.src = src;
  });
}

function sampleImageToCells(imageData: ImageData, width: number, height: number): SampledColor[] {
  const cellW = imageData.width / width;
  const cellH = imageData.height / height;
  return Array.from({ length: width * height }, (_, index) => {
    const row = Math.floor(index / width);
    const col = index % width;
    return sampleCell(imageData, col * cellW, row * cellH, cellW, cellH);
  });
}

function sampleCell(imageData: ImageData, x: number, y: number, w: number, h: number): SampledColor {
  const ratio = 0.64;
  const sx = x + (w * (1 - ratio)) / 2;
  const sy = y + (h * (1 - ratio)) / 2;
  const sw = w * ratio;
  const sh = h * ratio;
  const steps = 7;
  const samples: SampledColor[] = [];
  for (let py = 0; py < steps; py += 1) {
    for (let px = 0; px < steps; px += 1) {
      samples.push(pixelAt(imageData, sx + (px + 0.5) * (sw / steps), sy + (py + 0.5) * (sh / steps)));
    }
  }
  const visible = samples.filter((sample) => sample.alpha > 20);
  if (!visible.length) return { r: 255, g: 255, b: 255, alpha: 0 };
  return dominantColor(visible);
}

function dominantColor(samples: SampledColor[]): SampledColor {
  const med = {
    r: median(samples.map((sample) => sample.r)),
    g: median(samples.map((sample) => sample.g)),
    b: median(samples.map((sample) => sample.b))
  };
  const ranked = samples
    .map((sample) => ({ sample, distance: colorDistance(sample, med) }))
    .sort((a, b) => a.distance - b.distance);
  const kept = ranked.slice(0, Math.max(5, Math.ceil(ranked.length * 0.7))).map((item) => item.sample);
  return {
    r: trimmedMean(kept.map((sample) => sample.r)),
    g: trimmedMean(kept.map((sample) => sample.g)),
    b: trimmedMean(kept.map((sample) => sample.b)),
    alpha: trimmedMean(kept.map((sample) => sample.alpha))
  };
}

function adjustForMode(rgb: RGB, mode: PhotoColorMode): RGB {
  const hsl = rgbToHsl(rgb);
  if (mode === "vivid") return hslToRgb({ ...hsl, s: clamp01(hsl.s * 1.16), l: clamp01(hsl.l * 1.02) });
  if (mode === "soft") return hslToRgb({ ...hsl, s: clamp01(hsl.s * 0.82), l: clamp01(hsl.l * 1.04 + 0.015) });
  if (mode === "contrast") return hslToRgb({ ...hsl, s: clamp01(hsl.s * 1.05), l: clamp01((hsl.l - 0.5) * 1.18 + 0.5) });
  return rgb;
}

function selectPaletteForImage(samples: CellSample[], palette: BeadColor[], options: PhotoPatternOptions): BeadColor[] {
  if (!options.maxColors || options.maxColors >= palette.length) return palette;
  const colors = samples.filter((sample) => !sample.empty).map((sample) => sample.adjustedRgb);
  if (!colors.length) return palette;
  const centers = kMeansOklab(colors, Math.min(options.maxColors, colors.length), 8);
  const selected = new Map<string, BeadColor>();
  for (const center of centers) {
    const match = findClosestBeadColorWithDebug(center, palette, options.colorMode);
    selected.set(match.color.code, match.color);
  }
  if (selected.size < options.maxColors) {
    const mappedCounts = new Map<string, { color: BeadColor; total: number }>();
    for (const color of colors) {
      const match = findClosestBeadColorWithDebug(color, palette, options.colorMode);
      const item = mappedCounts.get(match.color.code) ?? { color: match.color, total: 0 };
      item.total += 1;
      mappedCounts.set(match.color.code, item);
    }
    for (const item of Array.from(mappedCounts.values()).sort((a, b) => b.total - a.total)) {
      selected.set(item.color.code, item.color);
      if (selected.size >= options.maxColors) break;
    }
  }
  return Array.from(selected.values());
}

function kMeansOklab(colors: RGB[], k: number, iterations: number): RGB[] {
  const sorted = [...colors].sort((a, b) => rgbToOklab(a).l - rgbToOklab(b).l);
  let centers = Array.from({ length: k }, (_, index) => sorted[Math.floor((index / Math.max(1, k - 1)) * (sorted.length - 1))]);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const groups = Array.from({ length: k }, () => [] as RGB[]);
    for (const color of colors) {
      const lab = rgbToOklab(color);
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < centers.length; index += 1) {
        const center = rgbToOklab(centers[index]);
        const distance = Math.hypot((lab.l - center.l) * 1.35, lab.a - center.a, lab.b - center.b);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }
      groups[bestIndex].push(color);
    }
    centers = centers.map((center, index) => groups[index].length ? averageRgb(groups[index]) : center);
  }
  return centers;
}

function buildCellBackgroundMask(samples: SampledColor[], width: number, height: number, rawOptions: BackgroundRemovalOptions): boolean[] {
  const options = normalizeBackgroundOptions(rawOptions);
  const direct = samples.map((sample) => isDirectBackground(sample, options));
  if (!options.protectRealWhiteAndGray) return direct;
  return keepOnlyEdgeConnectedBackground(direct, width, height);
}

function isDirectBackground(sample: SampledColor, options: BackgroundRemovalOptions): boolean {
  const rgb = { r: sample.r, g: sample.g, b: sample.b };
  if (options.removeTransparent && sample.alpha <= options.alphaThreshold) return true;
  if (options.removeNearBackgroundColor && options.backgroundSampleColor && isNearRgb(rgb, hexToRgb(options.backgroundSampleColor), options.backgroundTolerance)) return true;
  if (options.removeCheckerboardBackground && isLikelyCheckerboardPixel(rgb, options.checkerboardTolerance)) return true;
  if (options.removeWhiteBackground && isNearWhite(rgb, options.whiteThreshold)) return true;
  return false;
}

function keepOnlyEdgeConnectedBackground(directMask: boolean[], width: number, height: number): boolean[] {
  const edgeMask = new Array<boolean>(width * height).fill(false);
  const queue: number[] = [];
  const push = (x: number, y: number) => {
    const index = y * width + x;
    if (directMask[index] && !edgeMask[index]) {
      edgeMask[index] = true;
      queue.push(index);
    }
  };
  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  while (queue.length) {
    const index = queue.shift()!;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  return edgeMask;
}

function normalizeBackgroundOptions(options: BackgroundRemovalOptions): BackgroundRemovalOptions {
  if (options.mode === "none") return { ...options, removeTransparent: false, removeWhiteBackground: false, removeCheckerboardBackground: false, removeNearBackgroundColor: false };
  if (options.mode === "transparentOnly") return { ...options, removeTransparent: true, removeWhiteBackground: false, removeCheckerboardBackground: false, removeNearBackgroundColor: false };
  if (options.mode === "whiteBackground") return { ...options, removeTransparent: true, removeWhiteBackground: true, removeCheckerboardBackground: false, removeNearBackgroundColor: false };
  if (options.mode === "checkerboard") return { ...options, removeTransparent: true, removeWhiteBackground: false, removeCheckerboardBackground: true, removeNearBackgroundColor: false };
  if (options.mode === "pickedColor") return { ...options, removeTransparent: true, removeNearBackgroundColor: true };
  return options;
}

function smoothIsolatedCells(grid: PatternGrid, palette: BeadColor[]): PatternGrid {
  return grid.map((row, rowIndex) => row.map((cell, colIndex) => {
    if (cell.empty || !cell.colorCode) return cell;
    const neighbors = neighborCells(grid, rowIndex, colIndex).filter((item) => !item.empty && item.colorCode);
    const sameCount = neighbors.filter((item) => item.colorCode === cell.colorCode).length;
    if (sameCount >= 2 || neighbors.length < 5) return cell;
    const counts = new Map<string, number>();
    for (const neighbor of neighbors) counts.set(neighbor.colorCode, (counts.get(neighbor.colorCode) ?? 0) + 1);
    const dominant = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (!dominant || dominant[1] < 5) return cell;
    const color = palette.find((item) => item.code === dominant[0]);
    if (!color) return cell;
    return { ...cell, colorCode: color.code, colorName: color.name, hex: color.hex, symbol: color.symbol, matchedHex: color.hex };
  }));
}

function neighborCells(grid: PatternGrid, row: number, col: number) {
  const cells: PatternCell[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const next = grid[row + dr]?.[col + dc];
      if (next) cells.push(next);
    }
  }
  return cells;
}

function pixelAt(imageData: ImageData, x: number, y: number): SampledColor {
  const px = Math.max(0, Math.min(imageData.width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(imageData.height - 1, Math.round(y)));
  const i = (py * imageData.width + px) * 4;
  return { r: imageData.data[i], g: imageData.data[i + 1], b: imageData.data[i + 2], alpha: imageData.data[i + 3] };
}

function isLikelyCheckerboardPixel(rgb: RGB, tolerance: number): boolean {
  const hsl = rgbToHsl(rgb);
  if (hsl.s > 0.12) return false;
  return [255, 242, 229, 204, 192].some((target) =>
    Math.abs(rgb.r - target) <= tolerance &&
    Math.abs(rgb.g - target) <= tolerance &&
    Math.abs(rgb.b - target) <= tolerance
  );
}

function hslToRgb(hsl: { h: number; s: number; l: number }): RGB {
  const hueToRgb = (p: number, q: number, t: number) => {
    let next = t;
    if (next < 0) next += 1;
    if (next > 1) next -= 1;
    if (next < 1 / 6) return p + (q - p) * 6 * next;
    if (next < 1 / 2) return q;
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
    return p;
  };
  if (hsl.s === 0) {
    const value = hsl.l * 255;
    return { r: value, g: value, b: value };
  }
  const q = hsl.l < 0.5 ? hsl.l * (1 + hsl.s) : hsl.l + hsl.s - hsl.l * hsl.s;
  const p = 2 * hsl.l - q;
  return {
    r: hueToRgb(p, q, hsl.h + 1 / 3) * 255,
    g: hueToRgb(p, q, hsl.h) * 255,
    b: hueToRgb(p, q, hsl.h - 1 / 3) * 255
  };
}

function averageRgb(colors: RGB[]): RGB {
  return {
    r: colors.reduce((sum, color) => sum + color.r, 0) / colors.length,
    g: colors.reduce((sum, color) => sum + color.g, 0) / colors.length,
    b: colors.reduce((sum, color) => sum + color.b, 0) / colors.length
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function trimmedMean(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const trim = values.length >= 8 ? Math.floor(values.length * 0.12) : 0;
  const kept = sorted.slice(trim, sorted.length - trim || sorted.length);
  return kept.reduce((sum, value) => sum + value, 0) / kept.length;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
