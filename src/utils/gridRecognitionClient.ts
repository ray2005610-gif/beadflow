import type { BeadColor } from "../types/bead";
import type { ChartLocalPaletteEntry, GridCalibration, GridRecognitionOptions } from "../types/calibration";
import type { PatternGrid } from "../types/pattern";
import { defaultRecognitionOptions } from "./gridRecognition";
import { loadImage } from "./imageToPattern";
import { createRecognitionProfile, recordRecognitionStages } from "./recognitionProfile";
import type { LegendEntry } from "../types/legend";
export async function recognizeGridPatternFromImage(
  imageDataUrl: string,
  calibration: GridCalibration,
  palette: BeadColor[],
  options: GridRecognitionOptions = defaultRecognitionOptions,
  chartLocalPalette: ChartLocalPaletteEntry[] = [],
  legend: LegendEntry[] = [],
  signal?: AbortSignal
): Promise<PatternGrid> {
  const profile = createRecognitionProfile();
  const imageData = await readImageData(imageDataUrl, profile);
  if (signal?.aborted) throw new DOMException("辨識已取消", "AbortError");
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/gridRecognition.worker.ts", import.meta.url), { type: "module" });
    const stop = () => { worker.terminate(); signal?.removeEventListener("abort",abort); };
    const abort = () => { stop(); reject(new DOMException("辨識已取消", "AbortError")); };
    signal?.addEventListener("abort",abort,{once:true});
    worker.onmessage = (event) => {
      stop();
      recordRecognitionStages({ ...profile.stages, ...event.data.stages });
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.grid);
    };
    worker.onerror = (event) => { stop(); reject(new Error(event.message || "辨識處理失敗，請重新嘗試")); };
    worker.postMessage({ imageData, calibration, palette, options, chartLocalPalette, legend }, [imageData.data.buffer]);
  });
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
