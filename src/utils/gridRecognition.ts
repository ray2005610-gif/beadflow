import type { BeadColor, RGB } from "../types/bead";
import type { GridCalibration, GridRecognitionOptions } from "../types/calibration";
import type { PatternGrid } from "../types/pattern";
import { findClosestBeadColorWithDebug, rgbToHex, rgbToHsl } from "./colorUtils";
import { createEmptyCell, loadImage } from "./imageToPattern";

export const defaultRecognitionOptions: GridRecognitionOptions = {
  sampleMode: "symbolAware",
  ignoreGridLines: true,
  centerSampleRatio: 0.45,
  confidenceThreshold: 0.75
};

type SampledPixel = RGB & { alpha: number };

export async function recognizeGridPatternFromImage(
  imageDataUrl: string,
  calibration: GridCalibration,
  palette: BeadColor[],
  options: GridRecognitionOptions = defaultRecognitionOptions
): Promise<PatternGrid> {
  const image = await loadImage(imageDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("無法建立辨識畫布");
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const opt = { ...defaultRecognitionOptions, ...options };
  const crop = normalizeCrop(calibration);
  const outputRows = crop.endRow - crop.startRow + 1;
  const outputCols = crop.endCol - crop.startCol + 1;

  return Array.from({ length: outputRows }, (_, outRow) =>
    Array.from({ length: outputCols }, (_, outCol) => {
      const sourceRow = crop.startRow + outRow;
      const sourceCol = crop.startCol + outCol;
      const sample = sampleCell(imageData, calibration, sourceRow, sourceCol, opt);
      const rgb = { r: sample.r, g: sample.g, b: sample.b };
      if (sample.alpha <= 20) return createEmptyCell(outRow, outCol, rgb, sample.alpha, sourceRow, sourceCol);
      const match = findClosestBeadColorWithDebug(rgb, palette);
      return {
        row: outRow,
        col: outCol,
        sourceRow,
        sourceCol,
        colorCode: match.color.code,
        colorName: match.color.name,
        hex: match.color.hex,
        symbol: match.color.symbol,
        done: false,
        empty: false,
        rawRgb: rgb,
        rawHex: rgbToHex(rgb),
        matchedHex: match.color.hex,
        alpha: sample.alpha,
        confidence: match.confidence,
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

function sampleCell(imageData: ImageData, calibration: GridCalibration, row: number, col: number, options: GridRecognitionOptions): SampledPixel {
  const x = calibration.originX + col * calibration.cellWidth;
  const y = calibration.originY + row * calibration.cellHeight;
  const centerX = x + calibration.cellWidth / 2;
  const centerY = y + calibration.cellHeight / 2;
  if (options.sampleMode === "center") return pixelAt(imageData, centerX, centerY);

  const samples: SampledPixel[] = [];
  if (options.sampleMode === "symbolAware") {
    const marginX = calibration.cellWidth * 0.16;
    const marginY = calibration.cellHeight * 0.16;
    const points = [
      [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75],
      [0.5, 0.22], [0.22, 0.5], [0.78, 0.5], [0.5, 0.78]
    ];
    for (const [px, py] of points) {
      samples.push(pixelAt(imageData, x + marginX + px * (calibration.cellWidth - marginX * 2), y + marginY + py * (calibration.cellHeight - marginY * 2)));
    }
    return robustAverage(samples);
  }

  const ratio = Math.max(0.1, Math.min(0.8, options.centerSampleRatio));
  const sampleW = calibration.cellWidth * ratio;
  const sampleH = calibration.cellHeight * ratio;
  if (options.sampleMode === "ringSample") {
    const points = [[0, 0], [-0.2, 0], [0.2, 0], [0, -0.2], [0, 0.2], [-0.18, -0.18], [0.18, 0.18]];
    for (const [dx, dy] of points) samples.push(pixelAt(imageData, centerX + dx * sampleW, centerY + dy * sampleH));
  } else {
    const steps = 5;
    for (let sy = 0; sy < steps; sy += 1) {
      for (let sx = 0; sx < steps; sx += 1) {
        samples.push(pixelAt(imageData, centerX - sampleW / 2 + (sx + 0.5) * (sampleW / steps), centerY - sampleH / 2 + (sy + 0.5) * (sampleH / steps)));
      }
    }
  }
  return robustAverage(samples);
}

function pixelAt(imageData: ImageData, x: number, y: number): SampledPixel {
  const px = Math.max(0, Math.min(imageData.width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(imageData.height - 1, Math.round(y)));
  const i = (py * imageData.width + px) * 4;
  return { r: imageData.data[i], g: imageData.data[i + 1], b: imageData.data[i + 2], alpha: imageData.data[i + 3] };
}

function robustAverage(samples: SampledPixel[]): SampledPixel {
  const useful = samples.filter((sample) => {
    if (sample.alpha < 20) return false;
    const brightness = (sample.r + sample.g + sample.b) / 3;
    const saturation = rgbToHsl(sample).s;
    if (brightness < 45) return false;
    if (saturation < 0.08 && brightness > 80 && brightness < 230) return false;
    return true;
  });
  const source = useful.length >= 3 ? useful : samples.filter((sample) => sample.alpha >= 20);
  if (!source.length) return { r: 0, g: 0, b: 0, alpha: 0 };
  return {
    r: trimmedMean(source.map((sample) => sample.r)),
    g: trimmedMean(source.map((sample) => sample.g)),
    b: trimmedMean(source.map((sample) => sample.b)),
    alpha: trimmedMean(source.map((sample) => sample.alpha))
  };
}

function trimmedMean(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const trim = values.length >= 8 ? Math.floor(values.length * 0.1) : 0;
  const kept = sorted.slice(trim, sorted.length - trim || sorted.length);
  return kept.reduce((sum, value) => sum + value, 0) / kept.length;
}
