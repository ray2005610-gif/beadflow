import type { BeadColor, RGB } from "../types/bead";
import type { ChartLocalPaletteEntry, GridCalibration, GridRecognitionOptions } from "../types/calibration";
import type { PatternGrid } from "../types/pattern";
import { mardPaletteByCode } from "../data/mardPalette";
import { EMPTY_COLOR, EMPTY_COLOR_CODE } from "../data/emptyColor";
import { createColorMatcher, findClosestBeadColorWithDebug, hexToRgb, oklabDistance, rgbToHex, rgbToHsl, rgbToOklab } from "./colorUtils";
import { createEmptyCell } from "./imageToPattern";
import { isRecognitionStandardMardColor } from "../data/mardColorMeta";
import { createRecognitionProfile } from "./recognitionProfile";
import { correctIsolatedCells } from "./legendValidation";

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
  foregroundCoverage: number;
  backgroundConfidence: number;
};

export function recognizeGridPatternFromPixels(
  imageData: ImageData, calibration: GridCalibration, palette: BeadColor[],
  options: GridRecognitionOptions = defaultRecognitionOptions,
  chartLocalPalette: ChartLocalPaletteEntry[] = [],
  profile = createRecognitionProfile()
): PatternGrid {
  const coordinateStart = performance.now();
  if (![calibration.cellWidth, calibration.cellHeight, calibration.rows, calibration.columns].every(n => Number.isFinite(n) && n > 0)
    || calibration.rows > 120 || calibration.columns > 120) throw new Error("格線尺寸須有效，且不可超過 120 × 120");
  profile.add("gridDetection", 0); // Coordinates come from the user's 3x3 calibration, not an automatic detector.
  const opt = { ...defaultRecognitionOptions, ...options };
  const crop = normalizeCrop(calibration);
  const localEntries = chartLocalPalette.filter((entry) => entry.enabled && isValidHex(entry.sampledHex) && entry.code.trim());
  const localPalette = buildChartLocalPalette(localEntries);
  const candidates = localPalette.length ? localPalette : palette.filter(isRecognitionStandardMardColor);
  if (!candidates.length) throw new Error("沒有可用的標準色號");
  const matchColor = createColorMatcher(candidates);
  const outputRows = crop.endRow - crop.startRow + 1;
  const outputCols = crop.endCol - crop.startCol + 1;

  profile.add("gridCoordinates", performance.now() - coordinateStart);
  const classifications = Array.from({ length: outputRows }, (_, outRow) =>
    Array.from({ length: outputCols }, (_, outCol) => {
      const sourceRow = crop.startRow + outRow;
      const sourceCol = crop.startCol + outCol;
      const cellRect = {
        x: calibration.originX + sourceCol * calibration.cellWidth,
        y: calibration.originY + sourceRow * calibration.cellHeight,
        width: calibration.cellWidth,
        height: calibration.cellHeight
      };
      return classifyGridCellColor(cellRect, imageData, candidates, opt, matchColor, profile);
    })
  );
  const connectedBackground = profile.time("background", () => markConnectedBackground(classifications));

  const grid: PatternGrid = Array.from({ length: outputRows }, (_, outRow) =>
    Array.from({ length: outputCols }, (_, outCol) => {
      const sourceRow = crop.startRow + outRow;
      const sourceCol = crop.startCol + outCol;
      const classification = classifications[outRow][outCol];
      const rgb = classification.rgb;
      if (connectedBackground[outRow][outCol] || classification.empty || classification.alpha <= 20) {
        return createEmptyCell(outRow, outCol, rgb, classification.alpha, sourceRow, sourceCol);
      }

      const match = classification.match ?? matchColor(rgb);
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
        rawDetectedColor: resultColor.code,
        finalDetectedColor: resultColor.code,
        suspectedMismatch: false,
        rawRgb: rgb,
        rawHex: rgbToHex(rgb),
        matchedHex: match.color.hex,
        alpha: classification.alpha,
        confidence: Math.min(match.confidence, classification.confidence),
        distance: match.distance,
        adjustedDistance: match.adjustedDistance,
        // Candidate rankings are derived from rawRgb; duplicating them per cell exceeds localStorage quotas.
      };
    })
  );
  return profile.time("neighborCleanup", () => correctIsolatedCells(grid, candidates));
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
    if (!official || !isRecognitionStandardMardColor(official)) continue;
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
  options: GridRecognitionOptions,
  matchColor: ReturnType<typeof createColorMatcher>,
  profile: ReturnType<typeof createRecognitionProfile>
): CellClassification {
  const patches = profile.time("pixelSampling", () => sampleGridCellPatches(cellRect, imageData, options));
  const visible = patches.filter((patch) => patch.alpha > 20);
  const representative = profile.time("representativeColor", () => robustRepresentative(visible));
  const fallbackRgb = { r: representative.r, g: representative.g, b: representative.b };
  if (!visible.length) {
    return { rgb: fallbackRgb, alpha: 0, empty: true, confidence: 1, foregroundCoverage: 0, backgroundConfidence: 1 };
  }

  const mostlySolidExtreme = visible.filter(p => luminance(p) < 20).length / visible.length > 0.75
    || visible.filter(p => Math.min(p.r, p.g, p.b) > 245).length / visible.length > 0.75;
  const patchVotes = profile.time("paletteMatching", () => visible
    .map((patch) => {
      const rgb = { r: patch.r, g: patch.g, b: patch.b };
      const match = matchColor(rgb);
      return { patch, rgb, match };
    })
    .filter((vote) => {
      const hsl = rgbToHsl(vote.rgb);
      const textOrGrid = hsl.l < 0.08 || (hsl.l > 0.96 && hsl.s < 0.08);
      const tooFarFromKnownColors = candidates.length <= 32 && vote.match.adjustedDistance > 62;
      return (mostlySolidExtreme || !textOrGrid) && !tooFarFromKnownColors;
    }));
  const foregroundCoverage = patchVotes.length / Math.max(1, visible.length);
  const backgroundConfidence = estimateBackgroundConfidence(visible, patchVotes.length);

  if (isCheckerboardTransparentCell(visible, patchVotes)) {
    return { rgb: fallbackRgb, alpha: representative.alpha, empty: true, confidence: 0.82, foregroundCoverage, backgroundConfidence: Math.max(backgroundConfidence, 0.9) };
  }

  if (!patchVotes.length) {
    return { rgb: fallbackRgb, alpha: representative.alpha, empty: true, confidence: 0.35, foregroundCoverage, backgroundConfidence: Math.max(backgroundConfidence, 0.72) };
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
    foregroundCoverage,
    backgroundConfidence,
    match: {
      ...bestVote.match,
      color: bestColor
    }
  };
}

function markConnectedBackground(classifications: CellClassification[][]): boolean[][] {
  const height = classifications.length;
  const width = classifications[0]?.length ?? 0;
  const visited = Array.from({ length: height }, () => Array.from({ length: width }, () => false));
  const queue: Array<{ row: number; col: number }> = [];

  const enqueueIfBackground = (row: number, col: number) => {
    if (row < 0 || row >= height || col < 0 || col >= width || visited[row][col]) return;
    if (!isTraversableBackground(classifications[row][col], true)) return;
    visited[row][col] = true;
    queue.push({ row, col });
  };

  for (let col = 0; col < width; col += 1) {
    enqueueIfBackground(0, col);
    enqueueIfBackground(height - 1, col);
  }
  for (let row = 0; row < height; row += 1) {
    enqueueIfBackground(row, 0);
    enqueueIfBackground(row, width - 1);
  }

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    if (!current) break;
    const neighbors = [
      { row: current.row - 1, col: current.col },
      { row: current.row + 1, col: current.col },
      { row: current.row, col: current.col - 1 },
      { row: current.row, col: current.col + 1 }
    ];
    for (const next of neighbors) {
      if (next.row < 0 || next.row >= height || next.col < 0 || next.col >= width || visited[next.row][next.col]) continue;
      if (!isTraversableBackground(classifications[next.row][next.col], false)) continue;
      visited[next.row][next.col] = true;
      queue.push(next);
    }
  }

  return visited;
}

function isTraversableBackground(classification: CellClassification, onBorder: boolean): boolean {
  if (classification.empty || classification.alpha <= 20) return true;
  if (classification.backgroundConfidence >= 0.82 && classification.foregroundCoverage < 0.46) return true;
  if (classification.foregroundCoverage < 0.24 && classification.confidence < 0.7) return true;
  if (onBorder && classification.backgroundConfidence >= 0.7 && classification.confidence < 0.78) return true;
  return false;
}

function estimateBackgroundConfidence(samples: SampledPixel[], keptVoteCount: number): number {
  if (!samples.length) return 1;
  const hslValues = samples.map(rgbToHsl);
  const lightNeutralRatio = hslValues.filter((hsl) => hsl.l >= 0.88 && hsl.s <= 0.16).length / samples.length;
  const darkBorderRatio = hslValues.filter((hsl) => hsl.l <= 0.1 && hsl.s <= 0.16).length / samples.length;
  const transparentRatio = samples.filter((sample) => sample.alpha <= 20).length / samples.length;
  const foregroundRatio = keptVoteCount / Math.max(1, samples.length);
  const luminances = samples.map(luminance);
  const minLuminance = Math.min(...luminances);
  const maxLuminance = Math.max(...luminances);
  const checkerLike = hslValues.every((hsl) => hsl.s <= 0.1) && maxLuminance - minLuminance > 34;
  return Math.max(
    transparentRatio,
    lightNeutralRatio * 0.86,
    darkBorderRatio * 0.78,
    checkerLike ? 0.78 : 0,
    foregroundRatio < 0.18 ? 0.68 : 0
  );
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
  if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) return { r: 255, g: 255, b: 255, alpha: 0 };
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
