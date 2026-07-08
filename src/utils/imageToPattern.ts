import type { BeadColor, RGB } from "../types/bead";
import type { PatternCell, PatternGrid } from "../types/pattern";
import {
  colorDistance,
  findClosestBeadColorWithDebug,
  hexToRgb,
  isNearRgb,
  rgbToHex,
  rgbToHsl,
  rgbToOklab,
  type ColorMatchMode
} from "./colorUtils";
import { EMPTY_COLOR, isEmptyOrTransparentCell } from "../data/emptyColor";

export type PhotoColorMode = ColorMatchMode;
export type PhotoFitMode = "contain" | "stretch" | "crop" | "manual";
export type PhotoImageKind = "auto" | "photo" | "lineArt";

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
  fitMode: PhotoFitMode;
  manualScale: number;
  offsetX: number;
  offsetY: number;
  imageKind: PhotoImageKind;
};

export type PhotoPatternMeta = {
  boardWidth: number;
  boardHeight: number;
  patternWidth: number;
  patternHeight: number;
  offsetX: number;
  offsetY: number;
  blankCells: number;
  beadCells: number;
  fitMode: PhotoFitMode;
  detectedKind: Exclude<PhotoImageKind, "auto">;
};

export type PhotoPatternResult = {
  grid: PatternGrid;
  meta: PhotoPatternMeta;
};

type SampledColor = RGB & { alpha: number };
type CellPixels = {
  row: number;
  col: number;
  insideImage: boolean;
  pixels: SampledColor[];
};
type CellSample = {
  row: number;
  col: number;
  rgb: RGB;
  adjustedRgb: RGB;
  alpha: number;
  empty: boolean;
};
type Placement = {
  patternWidth: number;
  patternHeight: number;
  offsetX: number;
  offsetY: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  fitMode: PhotoFitMode;
};
type ImageCharacteristics = {
  transparencyRatio: number;
  estimatedPaletteSize: number;
  edgeDensity: number;
  flatAreaRatio: number;
  hasAlpha: boolean;
  likelyLineArt: boolean;
  likelyPhoto: boolean;
  backgroundRgb: RGB;
};

export const defaultPhotoPatternOptions: PhotoPatternOptions = {
  colorMode: "natural",
  maxColors: 0,
  fitMode: "contain",
  manualScale: 1,
  offsetX: 0,
  offsetY: 0,
  imageKind: "auto"
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
  if (color.code === EMPTY_COLOR.code) {
    return Array.from({ length: height }, (_, row) =>
      Array.from({ length: width }, (_, col) => createEmptyCell(row, col))
    );
  }
  return Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, col) => ({ row, col, colorCode: color.code, colorName: color.name, hex: color.hex, symbol: color.symbol, done: false, empty: false }))
  );
}

export function createEmptyCell(row: number, col: number, rawRgb?: RGB, alpha?: number, sourceRow?: number, sourceCol?: number): PatternCell {
  return {
    row,
    col,
    colorCode: EMPTY_COLOR.code,
    colorName: EMPTY_COLOR.name,
    hex: EMPTY_COLOR.hex,
    symbol: EMPTY_COLOR.symbol,
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
  rawPhotoOptions: Partial<PhotoPatternOptions> = defaultPhotoPatternOptions
): Promise<PhotoPatternResult> {
  return convertImageToBeadPatternV2(imageDataUrl, width, height, palette, backgroundOptions, rawPhotoOptions);
}

export async function convertImageToBeadPatternV2(
  imageDataUrl: string,
  width: number,
  height: number,
  palette: BeadColor[],
  backgroundOptions: BackgroundRemovalOptions = defaultBackgroundRemovalOptions,
  rawPhotoOptions: Partial<PhotoPatternOptions> = defaultPhotoPatternOptions
): Promise<PhotoPatternResult> {
  const photoOptions = { ...defaultPhotoPatternOptions, ...rawPhotoOptions };
  const image = await loadImage(imageDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("無法建立圖片分析畫布");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const globalInfo = analyzeImageCharacteristics(imageData);
  const detectedKind = photoOptions.imageKind === "auto" ? (globalInfo.likelyLineArt ? "lineArt" : "photo") : photoOptions.imageKind;
  const placement = computePatternFit(imageData.width, imageData.height, width, height, photoOptions);
  const cellPixels = buildCellPixels(imageData, width, height, placement, detectedKind);
  const rawSamples = cellPixels.map((cell) => convertCellPixelsToSample(cell, detectedKind, globalInfo, backgroundOptions));
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
      empty: sample.alpha <= 0
    };
  });
  const paletteForImage = detectedKind === "lineArt"
    ? buildCandidatePaletteForLimitedColorImage(cellSamples, palette, photoOptions.colorMode)
    : selectPaletteForImage(cellSamples, palette, photoOptions);

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
  const finalGrid = detectedKind === "photo" ? smoothIsolatedCells(grid, paletteForImage) : preserveLineArtGrid(grid);
  const beadCells = finalGrid.flat().filter((cell) => !isEmptyOrTransparentCell(cell)).length;
  return {
    grid: finalGrid,
    meta: {
      boardWidth: width,
      boardHeight: height,
      patternWidth: placement.patternWidth,
      patternHeight: placement.patternHeight,
      offsetX: placement.offsetX,
      offsetY: placement.offsetY,
      blankCells: width * height - beadCells,
      beadCells,
      fitMode: placement.fitMode,
      detectedKind
    }
  };
}

export function calculatePhotoPlacement(imageWidth: number, imageHeight: number, boardWidth: number, boardHeight: number, options: Partial<PhotoPatternOptions>): Placement {
  return computePatternFit(imageWidth, imageHeight, boardWidth, boardHeight, options);
}

function computePatternFit(imageWidth: number, imageHeight: number, boardWidth: number, boardHeight: number, options: Partial<PhotoPatternOptions>): Placement {
  const fitMode = options.fitMode ?? "contain";
  if (fitMode === "stretch") return { patternWidth: boardWidth, patternHeight: boardHeight, offsetX: 0, offsetY: 0, cropX: 0, cropY: 0, cropWidth: imageWidth, cropHeight: imageHeight, fitMode };
  if (fitMode === "crop") {
    const boardRatio = boardWidth / boardHeight;
    const imageRatio = imageWidth / imageHeight;
    let cropWidth = imageWidth;
    let cropHeight = imageHeight;
    let cropX = 0;
    let cropY = 0;
    if (imageRatio > boardRatio) {
      cropWidth = imageHeight * boardRatio;
      cropX = (imageWidth - cropWidth) / 2;
    } else {
      cropHeight = imageWidth / boardRatio;
      cropY = (imageHeight - cropHeight) / 2;
    }
    return { patternWidth: boardWidth, patternHeight: boardHeight, offsetX: 0, offsetY: 0, cropX, cropY, cropWidth, cropHeight, fitMode };
  }
  const containScale = Math.min(boardWidth / imageWidth, boardHeight / imageHeight);
  const manualScale = fitMode === "manual" ? Math.max(0.1, Math.min(3, options.manualScale ?? 1)) : 1;
  const scaledWidth = Math.max(1, Math.min(boardWidth, Math.round(imageWidth * containScale * manualScale)));
  const scaledHeight = Math.max(1, Math.min(boardHeight, Math.round(imageHeight * containScale * manualScale)));
  const centeredX = Math.round((boardWidth - scaledWidth) / 2);
  const centeredY = Math.round((boardHeight - scaledHeight) / 2);
  const offsetX = Math.max(0, Math.min(boardWidth - scaledWidth, centeredX + Math.round(options.offsetX ?? 0)));
  const offsetY = Math.max(0, Math.min(boardHeight - scaledHeight, centeredY + Math.round(options.offsetY ?? 0)));
  return { patternWidth: scaledWidth, patternHeight: scaledHeight, offsetX, offsetY, cropX: 0, cropY: 0, cropWidth: imageWidth, cropHeight: imageHeight, fitMode };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("圖片載入失敗"));
    image.src = src;
  });
}

export function analyzeImageCharacteristics(imageData: ImageData): ImageCharacteristics {
  const stride = Math.max(1, Math.floor(Math.sqrt((imageData.width * imageData.height) / 12000)));
  let total = 0;
  let transparent = 0;
  let backgroundLike = 0;
  let saturatedOrDark = 0;
  let edgeCount = 0;
  const bins = new Set<string>();
  const cornerColors = collectCornerPixels(imageData);
  const backgroundRgb = dominantColor(cornerColors.filter((pixel) => pixel.alpha > 20));

  for (let y = 0; y < imageData.height; y += stride) {
    for (let x = 0; x < imageData.width; x += stride) {
      const pixel = pixelAt(imageData, x, y);
      total += 1;
      if (pixel.alpha <= 20) {
        transparent += 1;
        continue;
      }
      const hsl = rgbToHsl(pixel);
      if (isLikelyBackgroundPixel(pixel, backgroundRgb, defaultBackgroundRemovalOptions, true)) backgroundLike += 1;
      if (hsl.s > 0.18 || hsl.l < 0.36) saturatedOrDark += 1;
      if (sobelAt(imageData, x, y) > 42) edgeCount += 1;
      bins.add(`${Math.round(pixel.r / 24)},${Math.round(pixel.g / 24)},${Math.round(pixel.b / 24)}`);
    }
  }

  const transparencyRatio = transparent / Math.max(1, total);
  const flatAreaRatio = backgroundLike / Math.max(1, total);
  const edgeDensity = edgeCount / Math.max(1, total);
  const estimatedPaletteSize = bins.size;
  const likelyLineArt = (transparencyRatio + flatAreaRatio > 0.38) && saturatedOrDark / Math.max(1, total) > 0.015 && estimatedPaletteSize < 160 && edgeDensity > 0.012;
  return {
    transparencyRatio,
    estimatedPaletteSize,
    edgeDensity,
    flatAreaRatio,
    hasAlpha: transparencyRatio > 0.01,
    likelyLineArt,
    likelyPhoto: !likelyLineArt,
    backgroundRgb
  };
}

function buildCellPixels(imageData: ImageData, width: number, height: number, placement: Placement, imageKind: Exclude<PhotoImageKind, "auto">): CellPixels[] {
  return Array.from({ length: width * height }, (_, index) => {
    const row = Math.floor(index / width);
    const col = index % width;
    if (!cellInPlacedImage(row, col, placement)) return { row, col, insideImage: false, pixels: [] };
    const rect = mapCellToSourceRect(row, col, placement);
    return { row, col, insideImage: true, pixels: sampleCellPixels(imageData, rect, imageKind) };
  });
}

function mapCellToSourceRect(row: number, col: number, placement: Placement) {
  const localCol = col - placement.offsetX;
  const localRow = row - placement.offsetY;
  const cellW = placement.cropWidth / placement.patternWidth;
  const cellH = placement.cropHeight / placement.patternHeight;
  return {
    x: placement.cropX + localCol * cellW,
    y: placement.cropY + localRow * cellH,
    w: cellW,
    h: cellH
  };
}

function sampleCellPixels(imageData: ImageData, rect: { x: number; y: number; w: number; h: number }, imageKind: Exclude<PhotoImageKind, "auto">): SampledColor[] {
  const steps = imageKind === "lineArt" ? 10 : 7;
  const ratio = imageKind === "lineArt" ? 1 : 0.62;
  const sx = rect.x + (rect.w * (1 - ratio)) / 2;
  const sy = rect.y + (rect.h * (1 - ratio)) / 2;
  const sw = rect.w * ratio;
  const sh = rect.h * ratio;
  const pixels: SampledColor[] = [];
  for (let py = 0; py < steps; py += 1) {
    for (let px = 0; px < steps; px += 1) {
      pixels.push(pixelAt(imageData, sx + (px + 0.5) * (sw / steps), sy + (py + 0.5) * (sh / steps)));
    }
  }
  return pixels;
}

function convertCellPixelsToSample(cell: CellPixels, imageKind: Exclude<PhotoImageKind, "auto">, globalInfo: ImageCharacteristics, options: BackgroundRemovalOptions): SampledColor {
  if (!cell.insideImage || !cell.pixels.length) return { r: 255, g: 255, b: 255, alpha: 0 };
  return imageKind === "lineArt" ? sampleLineAwareColor(cell.pixels, globalInfo, options) : samplePhotoColor(cell.pixels, globalInfo, options);
}

function samplePhotoColor(pixels: SampledColor[], globalInfo: ImageCharacteristics, options: BackgroundRemovalOptions): SampledColor {
  const visible = pixels.filter((pixel) => pixel.alpha > options.alphaThreshold);
  if (!visible.length) return { r: 255, g: 255, b: 255, alpha: 0 };
  const nonBackground = visible.filter((pixel) => !isLikelyBackgroundPixel(pixel, globalInfo.backgroundRgb, options, false));
  const usable = nonBackground.length >= Math.max(3, visible.length * 0.18) ? nonBackground : visible;
  return getRepresentativeColor(usable, false);
}

function sampleLineAwareColor(pixels: SampledColor[], globalInfo: ImageCharacteristics, options: BackgroundRemovalOptions): SampledColor {
  const visible = pixels.filter((pixel) => pixel.alpha > options.alphaThreshold);
  if (!visible.length) return { r: 255, g: 255, b: 255, alpha: 0 };
  const foreground = visible.filter((pixel) => !isLikelyBackgroundPixel(pixel, globalInfo.backgroundRgb, options, true));
  const important = detectImportantLinePixels(foreground, globalInfo);
  const foregroundRatio = foreground.length / pixels.length;
  const importantRatio = important.length / pixels.length;
  if (foregroundRatio < 0.045 && importantRatio < 0.025) return { r: 255, g: 255, b: 255, alpha: 0 };
  const colorPixels = important.length >= 2 ? important : foreground;
  return getRepresentativeColor(colorPixels, true);
}

function isLikelyBackgroundPixel(pixel: SampledColor, globalBackground: RGB, options: BackgroundRemovalOptions, lineArt: boolean): boolean {
  if (pixel.alpha <= options.alphaThreshold) return true;
  if (options.mode === "none") return false;
  if (options.mode === "pickedColor" && options.backgroundSampleColor && isNearRgb(pixel, hexToRgb(options.backgroundSampleColor), options.backgroundTolerance)) return true;
  if (isLikelyCheckerboardPixel(pixel, options.checkerboardTolerance)) return true;
  const hsl = rgbToHsl(pixel);
  if (lineArt && hsl.l >= 0.83 && hsl.s <= 0.24) return true;
  if (lineArt && isNearRgb(pixel, globalBackground, 36) && hsl.s <= 0.28) return true;
  return false;
}

function detectImportantLinePixels(pixels: SampledColor[], globalInfo: ImageCharacteristics): SampledColor[] {
  return pixels.filter((pixel) => {
    const hsl = rgbToHsl(pixel);
    const colorInk = hsl.s > 0.18 && !isNearRgb(pixel, globalInfo.backgroundRgb, 42);
    const darkInk = hsl.l < 0.48 && !isNearRgb(pixel, globalInfo.backgroundRgb, 36);
    return colorInk || darkInk;
  });
}

function getRepresentativeColor(samples: SampledColor[], preserveInk: boolean): SampledColor {
  if (!samples.length) return { r: 255, g: 255, b: 255, alpha: 0 };
  const med = {
    r: median(samples.map((sample) => sample.r)),
    g: median(samples.map((sample) => sample.g)),
    b: median(samples.map((sample) => sample.b))
  };
  const ranked = samples
    .map((sample) => ({ sample, distance: sampleDistanceToMedian(sample, med), score: inkScore(sample) }))
    .sort((a, b) => preserveInk ? b.score - a.score || a.distance - b.distance : a.distance - b.distance);
  const keptRatio = preserveInk ? 0.62 : 0.72;
  const kept = ranked.slice(0, Math.max(3, Math.ceil(ranked.length * keptRatio))).map((item) => item.sample);
  return {
    r: trimmedMean(kept.map((sample) => sample.r)),
    g: trimmedMean(kept.map((sample) => sample.g)),
    b: trimmedMean(kept.map((sample) => sample.b)),
    alpha: trimmedMean(kept.map((sample) => sample.alpha))
  };
}

function dominantColor(samples: SampledColor[]): SampledColor {
  return getRepresentativeColor(samples, false);
}

function inkScore(sample: SampledColor): number {
  const hsl = rgbToHsl(sample);
  return hsl.s * 1.45 + (1 - hsl.l) * 0.75 + sample.alpha / 255 * 0.2;
}

function sampleDistanceToMedian(sample: SampledColor, med: RGB): number {
  const sampleLab = rgbToOklab(sample);
  const medianLab = rgbToOklab(med);
  const perceptual = Math.hypot((sampleLab.l - medianLab.l) * 1.4, sampleLab.a - medianLab.a, sampleLab.b - medianLab.b) * 100;
  return perceptual + colorDistance(sample, med) * 0.18;
}

function adjustForMode(rgb: RGB, mode: PhotoColorMode): RGB {
  const hsl = rgbToHsl(rgb);
  if (mode === "vivid") return hslToRgb({ ...hsl, s: clamp01(hsl.s * 1.18), l: clamp01(hsl.l * 1.02) });
  if (mode === "soft") return hslToRgb({ ...hsl, s: clamp01(hsl.s * 0.82), l: clamp01(hsl.l * 1.04 + 0.015) });
  if (mode === "contrast") return hslToRgb({ ...hsl, s: clamp01(hsl.s * 1.06), l: clamp01((hsl.l - 0.5) * 1.18 + 0.5) });
  return rgb;
}

function buildCandidatePaletteForLimitedColorImage(samples: CellSample[], palette: BeadColor[], mode: PhotoColorMode): BeadColor[] {
  const colors = samples.filter((sample) => !sample.empty).map((sample) => sample.adjustedRgb);
  if (!colors.length) return palette;
  const centers = kMeansOklab(colors, Math.min(18, colors.length), 10);
  const selected = new Map<string, BeadColor>();
  for (const center of centers) {
    const match = findClosestBeadColorWithDebug(center, palette, mode);
    selected.set(match.color.code, match.color);
  }
  for (const color of colors) {
    const match = findClosestBeadColorWithDebug(color, palette, mode);
    selected.set(match.color.code, match.color);
    if (selected.size >= 36) break;
  }
  return selected.size ? Array.from(selected.values()) : palette;
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
  return selected.size ? Array.from(selected.values()) : palette;
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

function preserveLineArtGrid(grid: PatternGrid): PatternGrid {
  return grid;
}

function smoothIsolatedCells(grid: PatternGrid, palette: BeadColor[]): PatternGrid {
  return grid.map((row, rowIndex) => row.map((cell, colIndex) => {
    if (isEmptyOrTransparentCell(cell)) return cell;
    const neighbors = neighborCells(grid, rowIndex, colIndex).filter((item) => !isEmptyOrTransparentCell(item));
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

function cellInPlacedImage(row: number, col: number, placement: Placement): boolean {
  return row >= placement.offsetY && row < placement.offsetY + placement.patternHeight && col >= placement.offsetX && col < placement.offsetX + placement.patternWidth;
}

function pixelAt(imageData: ImageData, x: number, y: number): SampledColor {
  const px = Math.max(0, Math.min(imageData.width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(imageData.height - 1, Math.round(y)));
  const i = (py * imageData.width + px) * 4;
  return { r: imageData.data[i], g: imageData.data[i + 1], b: imageData.data[i + 2], alpha: imageData.data[i + 3] };
}

function collectCornerPixels(imageData: ImageData): SampledColor[] {
  const pixels: SampledColor[] = [];
  const marginX = Math.max(1, Math.floor(imageData.width * 0.08));
  const marginY = Math.max(1, Math.floor(imageData.height * 0.08));
  const steps = 8;
  for (let i = 0; i < steps; i += 1) {
    const x = (i / Math.max(1, steps - 1)) * marginX;
    const y = (i / Math.max(1, steps - 1)) * marginY;
    pixels.push(pixelAt(imageData, x, y));
    pixels.push(pixelAt(imageData, imageData.width - 1 - x, y));
    pixels.push(pixelAt(imageData, x, imageData.height - 1 - y));
    pixels.push(pixelAt(imageData, imageData.width - 1 - x, imageData.height - 1 - y));
  }
  return pixels;
}

function sobelAt(imageData: ImageData, x: number, y: number): number {
  const lum = (px: number, py: number) => {
    const pixel = pixelAt(imageData, px, py);
    return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
  };
  const gx = -lum(x - 1, y - 1) - 2 * lum(x - 1, y) - lum(x - 1, y + 1) + lum(x + 1, y - 1) + 2 * lum(x + 1, y) + lum(x + 1, y + 1);
  const gy = -lum(x - 1, y - 1) - 2 * lum(x, y - 1) - lum(x + 1, y - 1) + lum(x - 1, y + 1) + 2 * lum(x, y + 1) + lum(x + 1, y + 1);
  return Math.hypot(gx, gy);
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
