import { recognizeGridPatternFromPixels } from "../utils/gridRecognition";
import { createRecognitionProfile } from "../utils/recognitionProfile";
import { applySafeCorrections } from "../utils/legendValidation";

self.onmessage = (event) => {
  const profile = createRecognitionProfile();
  try {
    const { imageData, calibration, palette, options, chartLocalPalette, legend } = event.data;
    const detected = recognizeGridPatternFromPixels(imageData, calibration, palette, options, chartLocalPalette, profile);
    const grid = profile.time("legendValidation",()=>legend?.length ? applySafeCorrections(detected,legend) : detected);
    self.postMessage({ grid, stages: profile.finish() });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "辨識失敗" });
  }
};
