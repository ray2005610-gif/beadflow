import type { BeadColor, RGB } from "../types/bead";
import type { ChartLocalPaletteEntry, GridCalibration, GridRecognitionOptions } from "../types/calibration";
import type { PatternGrid } from "../types/pattern";
import { mardPaletteByCode } from "../data/mardPalette";
import { recognitionPalette } from "../data/recognitionPalette";
import { EMPTY_COLOR, EMPTY_COLOR_CODE } from "../data/emptyColor";
import { findClosestBeadColorWithDebug, hexToRgb, oklabDistance, rgbToHex, rgbToHsl, rgbToOklab } from "./colorUtils";
import { createEmptyCell, loadImage } from "./imageToPattern";

export const defaultRecognitionOptions: GridRecognitionOptions = {
  sampleMode: "symbolAware",
  ignoreGridLines: true,
  centerSampleRatio: 0.55,
  confidenceThreshold: 0.75
};

type SampledPixel = RGB & { alpha: number };
type PatchSample = SampledPixel & {
  xRatio: number;
  yRatio: number;
};

type CellClassification = {
  rgb: RGB;
  alpha: number;
  empty: boolean;
  match?: ReturnType<typeof findClosestBeadColorWithDebug>;
  confidence: number;
};

export async function recognizeGridPatternFromImage(
  imageDataUrl: string,
  calibration: GridCalibration,
  palette: BeadColor[],
  options: GridRecognitionOptions = defaultRecognitionOptions,
  chartLocalPalette: ChartLocalPaletteEntry[] = []
): Promise<PatternGrid> {
  const imageData = await readImageData(imageDataUrl);
  const opt = { ...defaultRecognitionOptions, ...options };
  const crop = normalizeCrop(calibration);
  const localEntries = chartLocalPalette.filter((entry) => entry.enabled && isValidHex(entry.sampledHex) && entry.code.trim());
  const localPalette = buildChartLocalPalette(localEntries);
  const candidates = localPalette.length ? localPalette : palette;
  const outputRows = crop.endRow - crop.startRow + 1;
  const outputCols = crop.endCol - crop.startCol + 1;

  return Array.from({ length: outputRows }, (_, outRow) =>
    Array.from({ length: outputCols }, (_, outCol) => {
      const sourceRow = crop.startRow + outRow;
      const sourceCol = crop.startCol + outCol;
      const cellRect = {
        x: calibration.originX + sourceCol * calibration.cellWidth,
        y: calibration.originY + sourceRow * calibration.cellHeight,
        width: calibration.cellWidth,
        height: calibration.cellHeight
      };
      const classification = classifyGridCellColor(cellRect, imageData, candidates, opt);
      const rgb = classification.rgb;
      if (classification.empty || classification.alpha <= 20) return createEmptyCell(outRow, outCol, rgb, classification.alpha, sourceRow, sourceCol);

      const match = classification.match ?? findClosestBeadColorWithDebug(rgb, candidates);
      if (match.color.code === EMPTY_COLOR_CODE) {
        return createEmptyCell(outRow, outCol, rgb, classification.alpha, sourceRow, sourceCol);
      }
      const official = mardPaletteByCode.get(match.color.code);
      const resultColor = official ?? match.color;
      return {
        row: outRow,
        col: outCol,
        sourceRow,
        sourceCol,
        colorCode: resultColor.code,
        colorName: resultColor.name,
        hex: resultColor.hex,
        symbol: resultColor.symbol,
        done: false,
        empty: false,
        rawRgb: rgb,
        rawHex: rgbToHex(rgb),
        matchedHex: match.color.hex,
        alpha: classification.alpha,
        confidence: Math.min(match.confidence, classification.confidence),
        distance: match.distance,
        adjustedDistance: match.adjustedDistance,
        candidates: match.candidates,
        rawHue: match.rawHue,
        rawSaturation: match.rawSaturation,
        rawLightness: match.rawLightness
      };
    })
  );
}

export async function extractLegendPalette(
  imageDataUrl: string,
  calibration: GridCalibration
): Promise<ChartLocalPaletteEntry[]> {
  const imageData = await readImageData(imageDataUrl);
  const gridBottom = calibration.originY + calibration.rows * calibration.cellHeight;
  const startY = Math.max(0, Math.floor(gridBottom + calibration.cellHeight * 0.35));
  if (startY >= imageData.height - 2) return [];

  const x0 = Math.max(0, Math.floor(calibration.originX - calibration.cellWidth));
  const x1 = Math.min(imageData.width, Math.ceil(calibration.originX + calibration.columns * calibration.cellWidth + calibration.cellWidth));
  const stride = Math.max(1, Math.round(Math.min(calibration.cellWidth, calibration.cellHeight) / 4));
  const bins = new Map<string, { pixels: SampledPixel[]; count: number }>();

  for (let y = startY; y < imageData.height; y += stride) {
    for (let x = x0; x < x1; x += stride) {
      const pixel = pixelAt(imageData, x, y);
      if (!isLegendColorPixel(pixel)) continue;
      const key = `${Math.round(pixel.r / 16)},${Math.round(pixel.g / 16)},${Math.round(pixel.b / 16)}`;
      const bin = bins.get(key) ?? { pixels: [], count: 0 };
      bin.count += 1;
      if (bin.pixels.length < 80) bin.pixels.push(pixel);
      bins.set(key, bin);
    }
  }

  const minimumCount = Math.max(3, Math.round((calibration.cellWidth * calibration.cellHeight) / Math.max(1, stride * stride) * 0.18));
  const colors = Array.from(bins.values())
    .filter((bin) => bin.count >= minimumCount)
    .sort((a, b) => b.count - a.count)
    .map((bin) => robustRepresentative(bin.pixels));

  const distinct: SampledPixel[] = [];
  for (const color of colors) {
    if (distinct.every((existing) => oklabDistance(rgbToOklab(existing), rgbToOklab(color)) > 4.2)) {
      distinct.push(color);
    }
    if (distinct.length >= 24) break;
  }

  const byCode = new Map<string, ChartLocalPaletteEntry>();
  distinct.forEach((color, index) => {
    const match = findClosestBeadColorWithDebug(color, recognitionPalette);
    const code = match.color.code.trim().toUpperCase();
    if (!code || code === EMPTY_COLOR_CODE || !mardPaletteByCode.has(code)) return;
    const previous = byCode.get(code);
    if (previous && (previous.confidence ?? 0) >= match.confidence) return;
    byCode.set(code, {
      id: previous?.id ?? crypto.randomUUID(),
      code,
      sampledHex: rgbToHex(color),
      officialHex: mardPaletteByCode.get(code)?.hex,
      source: "legend",
      confidence: Math.max(0.55, Math.min(0.98, match.confidence - index * 0.004)),
      enabled: true
    });
  });

  return Array.from(byCode.values()).slice(0, 24);
}

export function buildChartLocalPalette(entries: ChartLocalPaletteEntry[]): BeadColor[] {
  const unique = new Map<string, BeadColor>();
  for (const entry of entries) {
    const code = entry.code.trim().toUpperCase();
    if (!code || !entry.enabled || !isValidHex(entry.sampledHex)) continue;
    const official = mardPaletteByCode.get(code);
    if (code === EMPTY_COLOR_CODE || code === "EMPTY") {
      unique.set(EMPTY_COLOR_CODE, { ...EMPTY_COLOR, hex: entry.sampledHex });
      continue;
    }
    if (!official) continue;
    unique.set(code, {
      ...official,
      code,
      hex: entry.sampledHex,
      symbol: official.symbol ?? code
    });
  }
  return Array.from(unique.values());
}

export function sampleGridCellColor(
  cellRect: { x: number; y: number; width: number; height: number },
  imageData: ImageData,
  options: GridRecognitionOptions = defaultRecognitionOptions
): SampledPixel {
  return robustRepresentative(sampleGridCellPatches(cellRect, imageData, options));
}

function classifyGridCellColor(
  cellRect: { x: number; y: number; width: number; height: number },
  imageData: ImageData,
  candidates: BeadColor[],
  options: GridRecognitionOptions = defaultRecognitionOptions
): CellClassification {
  const patches = sampleGridCellPatches(cellRect, imageData, options);
  const visible = patches.filter((patch) => patch.alpha > 20);
  const representative = robustRepresentative(visible);
  const fallbackRgb = { r: representative.r, g: representative.g, b: representative.b };
  if (!visible.length) return { rgb: fallbackRgb, alpha: 0, empty: true, confidence: 1 };

  const patchVotes = visible
    .map((patch) => {
      const rgb = { r: patch.r, g: patch.g, b: patch.b };
      const match = findClosestBeadColorWithDebug(rgb, candidates);
      return { patch, rgb, match };
    })
    .filter((vote) => {
      const hsl = rgbToHsl(vote.rgb);
      const textOrGrid = hsl.l < 0.08 || (hsl.l > 0.96 && hsl.s < 0.08);
      const tooFarFromKnownColors = candidates.length <= 32 && vote.match.adjustedDistance > 62;
      return !textOrGrid && !tooFarFromKnownColors;
    });

  if (isCheckerboardTransparentCell(visible, patchVotes)) {
    return { rgb: fallbackRgb, alpha: representative.alpha, empty: true, confidence: 0.82 };
  }

  if (!patchVotes.length) {
    return { rgb: fallbackRgb, alpha: representative.alpha, empty: true, confidence: 0.35 };
  }

  const votesByCode = new Map<string, { count: number; distance: number; colors: RGB[]; match: ReturnType<typeof findClosestBeadColorWithDebug> }>();
  for (const vote of patchVotes) {
    const code = vote.match.color.code;
    const current = votesByCode.get(code) ?? { count: 0, distance: 0, colors: [], match: vote.match };
    current.count += 1;
    current.distance += vote.match.adjustedDistance;
    current.colors.push(vote.rgb);
    if (vote.match.adjustedDistance < current.match.adjustedDistance) current.match = vote.match;
    votesByCode.set(code, current);
  }
  const ranked = Array.from(votesByCode.entries()).sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    return a[1].distance / a[1].count - b[1].distance / b[1].count;
  });
  const [bestCode, bestVote] = ranked[0];
  const bestColor = candidates.find((color) => color.code === bestCode) ?? bestVote.match.color;
  const rgb = averageRgb(bestVote.colors.length ? bestVote.colors : [fallbackRgb]);
  const confidence = Math.max(0.2, Math.min(1, bestVote.count / Math.max(1, patchVotes.length) * 0.72 + bestVote.match.confidence * 0.28));
  return {
    rgb,
    alpha: representative.alpha,
    empty: false,
    confidence,
    match: {
      ...bestVote.match,
      color: bestColor
    }
  };
}

function sampleGridCellPatches(
  cellRect: { x: number; y: number; width: number; height: number },
  imageData: ImageData,
  options: GridRecognitionOptions = defaultRecognitionOptions
): PatchSample[] {
  const patchCenters = [
    { xRatio: 0.24, yRatio: 0.24 },
    { xRatio: 0.76, yRatio: 0.24 },
    { xRatio: 0.24, yRatio: 0.76 },
    { xRatio: 0.76, yRatio: 0.76 },
    { xRatio: 0.24, yRatio: 0.5 },
    { xRatio: 0.76, yRatio: 0.5 },
    { xRatio: 0.5, yRatio: 0.24 },
    { xRatio: 0.5, yRatio: 0.76 }
  ];
  const samples: PatchSample[] = [];
  const patchRatio = Math.max(0.08, Math.min(0.16, (options.centerSampleRatio || 0.55) * 0.22));
  const perSide = 3;

  for (const center of patchCenters) {
    for (let y = 0; y < perSide; y += 1) {
      for (let x = 0; x < perSide; x += 1) {
        const localX = center.xRatio + ((x + 0.5) / perSide - 0.5) * patchRatio;
        const localY = center.yRatio + ((y + 0.5) / perSide - 0.5) * patchRatio;
        const pixel = pixelAt(imageData, cellRect.x + localX * cellRect.width, cellRect.y + localY * cellRect.height);
        samples.push({ ...pixel, xRatio: center.xRatio, yRatio: center.yRatio });
      }
    }
  }
  return samples;
}

function robustRepresentative(samples: SampledPixel[]): SampledPixel {
  const visible = samples.filter((sample) => sample.alpha > 20);
  if (!visible.length) return { r: 255, g: 255, b: 255, alpha: 0 };

  const med = {
    r: median(visible.map((sample) => sample.r)),
    g: median(visible.map((sample) => sample.g)),
    b: median(visible.map((sample) => sample.b))
  };
  const medLab = rgbToOklab(med);
  const ranked = visible
    .filter((sample) => {
      const hsl = rgbToHsl(sample);
      const nearBlackText = hsl.l < 0.13;
      const nearWhiteText = hsl.l > 0.97 && hsl.s < 0.08;
      return !nearBlackText && !nearWhiteText;
    })
    .map((sample) => ({ sample, distance: oklabDistance(rgbToOklab(sample), medLab) }))
    .sort((a, b) => a.distance - b.distance);
  const source = ranked.length >= 4
    ? ranked.slice(0, Math.max(4, Math.ceil(ranked.length * 0.7))).map((item) => item.sample)
    : visible;
  return {
    r: trimmedMean(source.map((sample) => sample.r)),
    g: trimmedMean(source.map((sample) => sample.g)),
    b: trimmedMean(source.map((sample) => sample.b)),
    alpha: trimmedMean(source.map((sample) => sample.alpha))
  };
}

function isCheckerboardTransparentCell(
  samples: SampledPixel[],
  votes: Array<{ rgb: RGB; match: ReturnType<typeof findClosestBeadColorWithDebug> }>
): boolean {
  const visible = samples.filter((sample) => sample.alpha > 20);
  if (visible.length < 8) return true;
  const hslValues = visible.map(rgbToHsl);
  const avgSaturation = hslValues.reduce((sum, hsl) => sum + hsl.s, 0) / hslValues.length;
  const luminances = visible.map(luminance);
  const meanLuminance = luminances.reduce((sum, value) => sum + value, 0) / luminances.length;
  const minLuminance = Math.min(...luminances);
  const maxLuminance = Math.max(...luminances);
  const variance = luminances.reduce((sum, value) => sum + Math.pow(value - meanLuminance, 2), 0) / luminances.length;
  const stableVoteRatio = votes.length / visible.length;
  const strongMajority = (() => {
    const counts = new Map<string, number>();
    for (const vote of votes) counts.set(vote.match.color.code, (counts.get(vote.match.color.code) ?? 0) + 1);
    return Math.max(0, ...counts.values()) / Math.max(1, votes.length);
  })();

  const lowChromaAlternatingLightness = avgSaturation < 0.08 && maxLuminance - minLuminance > 34 && variance > 180;
  const noStableKnownColor = stableVoteRatio < 0.42 || strongMajority < 0.52;
  return lowChromaAlternatingLightness && noStableKnownColor;
}

async function readImageData(imageDataUrl: string): Promise<ImageData> {
  const image = await loadImage(imageDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("無法建立格線辨識畫布");
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function isLegendColorPixel(pixel: SampledPixel): boolean {
  if (pixel.alpha <= 20) return false;
  const hsl = rgbToHsl(pixel);
  if (hsl.l < 0.08 || hsl.l > 0.96) return false;
  return hsl.s > 0.1 || hsl.l < 0.72;
}

function normalizeCrop(calibration: GridCalibration) {
  const range = calibration.cropRange;
  const startRow = clampInt(range?.startRow ?? 0, 0, Math.max(0, calibration.rows - 1));
  const endRow = clampInt(range?.endRow ?? calibration.rows - 1, startRow, Math.max(0, calibration.rows - 1));
  const startCol = clampInt(range?.startCol ?? 0, 0, Math.max(0, calibration.columns - 1));
  const endCol = clampInt(range?.endCol ?? calibration.columns - 1, startCol, Math.max(0, calibration.columns - 1));
  return { startRow, endRow, startCol, endCol };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function pixelAt(imageData: ImageData, x: number, y: number): SampledPixel {
  const px = Math.max(0, Math.min(imageData.width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(imageData.height - 1, Math.round(y)));
  const i = (py * imageData.width + px) * 4;
  return { r: imageData.data[i], g: imageData.data[i + 1], b: imageData.data[i + 2], alpha: imageData.data[i + 3] };
}

function luminance(rgb: RGB): number {
  return rgb.r * 0.2126 + rgb.g * 0.7152 + rgb.b * 0.0722;
}

function averageRgb(colors: RGB[]): RGB {
  return {
    r: colors.reduce((sum, color) => sum + color.r, 0) / colors.length,
    g: colors.reduce((sum, color) => sum + color.g, 0) / colors.length,
    b: colors.reduce((sum, color) => sum + color.b, 0) / colors.length
  };
}

function trimmedMean(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const trim = values.length >= 8 ? Math.floor(values.length * 0.12) : 0;
  const kept = sorted.slice(trim, sorted.length - trim || sorted.length);
  return kept.reduce((sum, value) => sum + value, 0) / kept.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function isValidHex(value: string): boolean {
  if (!/^#[0-9A-F]{6}$/i.test(value)) return false;
  try {
    hexToRgb(value);
    return true;
  } catch {
    return false;
  }
}
