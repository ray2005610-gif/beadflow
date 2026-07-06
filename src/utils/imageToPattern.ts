import type { BeadColor, RGB } from "../types/bead";
import type { PatternCell, PatternGrid } from "../types/pattern";
import { findClosestBeadColorWithDebug, hexToRgb, isNearRgb, isNearWhite, rgbToHex, rgbToHsl } from "./colorUtils";

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

export const defaultBackgroundRemovalOptions: BackgroundRemovalOptions = {
  mode: "auto",
  removeTransparent: true,
  alphaThreshold: 20,
  removeWhiteBackground: true,
  whiteThreshold: 240,
  removeCheckerboardBackground: true,
  checkerboardTolerance: 18,
  removeNearBackgroundColor: false,
  backgroundSampleColor: undefined,
  backgroundTolerance: 30,
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
  backgroundOptions: BackgroundRemovalOptions = defaultBackgroundRemovalOptions
): Promise<PatternGrid> {
  const image = await loadImage(imageDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("無法建立圖片轉換畫布");
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const backgroundMask = buildBackgroundMask(imageData, backgroundOptions);
  const data = imageData.data;

  return Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, col) => {
      const i = (row * width + col) * 4;
      const alpha = data[i + 3];
      const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
      const backgroundReason = backgroundMask[row * width + col];
      if (backgroundReason) return { ...createEmptyCell(row, col, rgb, alpha, row, col), backgroundReason };
      const match = findClosestBeadColorWithDebug(rgb, palette);
      return {
        row,
        col,
        colorCode: match.color.code,
        colorName: match.color.name,
        hex: match.color.hex,
        symbol: match.color.symbol,
        done: false,
        empty: false,
        rawRgb: rgb,
        rawHex: rgbToHex(rgb),
        matchedHex: match.color.hex,
        alpha,
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
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("圖片載入失敗"));
    image.src = src;
  });
}

function buildBackgroundMask(imageData: ImageData, rawOptions: BackgroundRemovalOptions): Array<string | null> {
  const options = normalizeBackgroundOptions(rawOptions);
  const { width, height, data } = imageData;
  const edgeBackgroundColors = collectEdgeBackgroundColors(imageData, options);
  const directReasons = Array.from({ length: width * height }, (_, index) => {
    const i = index * 4;
    const alpha = data[i + 3];
    const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
    if (options.removeTransparent && alpha <= options.alphaThreshold) return "透明背景";
    if (options.removeNearBackgroundColor && options.backgroundSampleColor && isNearRgb(rgb, hexToRgb(options.backgroundSampleColor), options.backgroundTolerance)) return "指定背景色";
    if (options.removeCheckerboardBackground && isLikelyCheckerboardPixel(rgb, options.checkerboardTolerance)) return "棋盤格背景";
    if (options.removeWhiteBackground && isNearWhite(rgb, options.whiteThreshold)) return "白色背景";
    if (edgeBackgroundColors.some((color) => isNearRgb(rgb, color, options.backgroundTolerance))) return "邊緣背景色";
    return null;
  });

  if (!options.protectRealWhiteAndGray) return directReasons;
  return keepOnlyEdgeConnectedBackground(directReasons, width, height);
}

function keepOnlyEdgeConnectedBackground(directReasons: Array<string | null>, width: number, height: number): Array<string | null> {
  const edgeMask = new Array<string | null>(width * height).fill(null);
  const queue: number[] = [];
  const push = (x: number, y: number) => {
    const index = y * width + x;
    if (directReasons[index] && !edgeMask[index]) {
      edgeMask[index] = directReasons[index];
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

function collectEdgeBackgroundColors(imageData: ImageData, options: BackgroundRemovalOptions): RGB[] {
  if (options.mode === "none" || options.mode === "transparentOnly") return [];
  const { width, height, data } = imageData;
  const samples: RGB[] = [];
  const push = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] <= options.alphaThreshold) return;
    const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const hsl = rgbToHsl(rgb);
    if (hsl.l > 0.72 && hsl.s < 0.18) samples.push(rgb);
  };
  const stepX = Math.max(1, Math.floor(width / 12));
  const stepY = Math.max(1, Math.floor(height / 12));
  for (let x = 0; x < width; x += stepX) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += stepY) {
    push(0, y);
    push(width - 1, y);
  }
  return dedupeColors(samples, 18).slice(0, 4);
}

function dedupeColors(colors: RGB[], tolerance: number): RGB[] {
  const result: RGB[] = [];
  for (const color of colors) {
    if (!result.some((item) => isNearRgb(item, color, tolerance))) result.push(color);
  }
  return result;
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
