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
  whiteThreshold: 245,
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
  if (!ctx) throw new Error("無法建立圖片處理畫布");
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
      if (backgroundMask[row * width + col]) return createEmptyCell(row, col, rgb, alpha, row, col);
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
        alpha,
        confidence: match.confidence,
        distance: match.distance,
        adjustedDistance: match.adjustedDistance,
        candidates: match.candidates,
        rawHue: match.rawHue,
        rawSaturation: match.rawSaturation,
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

function buildBackgroundMask(imageData: ImageData, rawOptions: BackgroundRemovalOptions): boolean[] {
  const options = normalizeBackgroundOptions(rawOptions);
  const { width, height, data } = imageData;
  const directMask = Array.from({ length: width * height }, (_, index) => {
    const i = index * 4;
    const alpha = data[i + 3];
    const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
    if (options.removeTransparent && alpha <= options.alphaThreshold) return true;
    if (options.removeNearBackgroundColor && options.backgroundSampleColor && isNearRgb(rgb, hexToRgb(options.backgroundSampleColor), options.backgroundTolerance)) return true;
    if (options.removeCheckerboardBackground && isLikelyCheckerboardPixel(rgb, options.checkerboardTolerance)) return true;
    if (options.removeWhiteBackground && isNearWhite(rgb, options.whiteThreshold)) return true;
    return false;
  });

  if (!options.protectRealWhiteAndGray) return directMask;
  return keepOnlyEdgeConnectedBackground(directMask, width, height);
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

function isLikelyCheckerboardPixel(rgb: RGB, tolerance: number): boolean {
  const hsl = rgbToHsl(rgb);
  if (hsl.s > 0.12) return false;
  return [255, 242, 229, 204, 192].some((target) =>
    Math.abs(rgb.r - target) <= tolerance &&
    Math.abs(rgb.g - target) <= tolerance &&
    Math.abs(rgb.b - target) <= tolerance
  );
}
