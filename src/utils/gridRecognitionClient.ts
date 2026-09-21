import type { BeadColor } from "../types/bead";
import type { ChartLocalPaletteEntry, GridCalibration, GridRecognitionOptions } from "../types/calibration";
import type { PatternGrid } from "../types/pattern";
import { defaultRecognitionOptions } from "./gridRecognition";
import { loadImage } from "./imageToPattern";
import { createRecognitionProfile, recordRecognitionStages } from "./recognitionProfile";
import type { GridRecognitionResult, GridTextEvidence, LegendEntry } from "../types/legend";
export async function recognizeGridPatternFromImage(
  imageDataUrl: string,
  calibration: GridCalibration,
  palette: BeadColor[],
  options: GridRecognitionOptions = defaultRecognitionOptions,
  chartLocalPalette: ChartLocalPaletteEntry[] = [],
  legend: LegendEntry[] = [],
  signal?: AbortSignal
): Promise<PatternGrid> {
  const result = await recognizeGridPatternDetailedFromImage(
    imageDataUrl, calibration, palette, options, chartLocalPalette, legend, signal
  );
  return result.grid;
}

export async function recognizeGridPatternDetailedFromImage(
  imageDataUrl: string,
  calibration: GridCalibration,
  palette: BeadColor[],
  options: GridRecognitionOptions = defaultRecognitionOptions,
  chartLocalPalette: ChartLocalPaletteEntry[] = [],
  legend: LegendEntry[] = [],
  signal?: AbortSignal
): Promise<GridRecognitionResult> {
  const profile = createRecognitionProfile();
  const imageData = await readImageData(imageDataUrl, profile);
  if (signal?.aborted) throw new DOMException("辨識已取消", "AbortError");
  const textEvidence = await readCellTextEvidence(imageData, calibration, legend, profile, signal);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/gridRecognition.worker.ts", import.meta.url), { type: "module" });
    const stop = () => { worker.terminate(); signal?.removeEventListener("abort",abort); };
    const abort = () => { stop(); reject(new DOMException("辨識已取消", "AbortError")); };
    signal?.addEventListener("abort",abort,{once:true});
    worker.onmessage = (event) => {
      stop();
      recordRecognitionStages({ ...profile.stages, ...event.data.stages });
      if (event.data.error) reject(new Error(event.data.error));
      else resolve({
        grid: event.data.grid,
        recognitionMode: event.data.recognitionMode ?? "image-driven",
        assignmentSummary: event.data.assignmentSummary
      });
    };
    worker.onerror = (event) => { stop(); reject(new Error(event.message || "辨識處理失敗，請重新嘗試")); };
    worker.postMessage({ imageData, calibration, palette, options, chartLocalPalette, legend, textEvidence }, [imageData.data.buffer]);
  });
}

async function readCellTextEvidence(
  imageData: ImageData,
  calibration: GridCalibration,
  legend: LegendEntry[],
  profile: ReturnType<typeof createRecognitionProfile>,
  signal?: AbortSignal
): Promise<GridTextEvidence[]> {
  const allowed = new Set(legend.filter((entry) => entry.confirmed).map((entry) => entry.colorCode.trim().toUpperCase()));
  const cellSize = Math.min(calibration.cellWidth, calibration.cellHeight);
  const crop = calibration.cropRange ?? { startRow: 0, endRow: calibration.rows - 1, startCol: 0, endCol: calibration.columns - 1 };
  const cellCount = (crop.endRow - crop.startRow + 1) * (crop.endCol - crop.startCol + 1);
  // Below this resolution OCR is noise; on very large charts color evidence remains the fast path.
  if (!allowed.size || cellSize < 14 || cellCount > 3600) return [];
  const started = performance.now();
  const source = document.createElement("canvas");
  source.width = imageData.width;
  source.height = imageData.height;
  source.getContext("2d")?.putImageData(imageData, 0, 0);
  const x = Math.max(0, Math.floor(calibration.originX + crop.startCol * calibration.cellWidth));
  const y = Math.max(0, Math.floor(calibration.originY + crop.startRow * calibration.cellHeight));
  const width = Math.max(1, Math.min(imageData.width - x, Math.ceil((crop.endCol - crop.startCol + 1) * calibration.cellWidth)));
  const height = Math.max(1, Math.min(imageData.height - y, Math.ceil((crop.endRow - crop.startRow + 1) * calibration.cellHeight)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(source, x, y, width, height, 0, 0, width, height);
  try {
    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker("eng", 1);
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        preserve_interword_spaces: "1"
      });
      const { data } = await worker.recognize(canvas, {}, { blocks: true });
      if (signal?.aborted) throw new DOMException("辨識已取消", "AbortError");
      const words = (data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words)));
      const best = new Map<string, GridTextEvidence>();
      for (const word of words) {
        const code = word.text.replace(/[^A-Z0-9]/gi, "").toUpperCase();
        if (!allowed.has(code) || word.confidence < 55) continue;
        const centerX = (word.bbox.x0 + word.bbox.x1) / 2;
        const centerY = (word.bbox.y0 + word.bbox.y1) / 2;
        const sourceCol = crop.startCol + Math.floor(centerX / calibration.cellWidth);
        const sourceRow = crop.startRow + Math.floor(centerY / calibration.cellHeight);
        if (sourceCol < crop.startCol || sourceCol > crop.endCol || sourceRow < crop.startRow || sourceRow > crop.endRow) continue;
        const evidence = { sourceRow, sourceCol, textCandidate: code, textConfidence: word.confidence / 100 };
        const key = `${sourceRow}:${sourceCol}`;
        if ((best.get(key)?.textConfidence ?? 0) < evidence.textConfidence) best.set(key, evidence);
      }
      return [...best.values()];
    } finally {
      await worker.terminate();
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return [];
  } finally {
    profile.add("cellTextRecognition", performance.now() - started);
  }
}

async function readImageData(imageDataUrl: string, profile: ReturnType<typeof createRecognitionProfile>): Promise<ImageData> {
  const start = performance.now();
  const image = await loadImage(imageDataUrl);
  profile.add("decode", performance.now() - start);
  const preprocessingStart = performance.now();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("無法建立格線辨識畫布");
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  profile.add("preprocessing", performance.now() - preprocessingStart);
  return data;
}
