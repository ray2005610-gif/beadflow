import { buildChartLocalPalette, recognizeGridPatternFromPixels } from "../utils/gridRecognition";
import { createRecognitionProfile } from "../utils/recognitionProfile";
import { assignLegendCapacities, buildConfirmedLegendPalette } from "../utils/legendAssignment";
import type { LegendEntry } from "../types/legend";

self.onmessage = (event) => {
  const profile = createRecognitionProfile();
  try {
    const { imageData, calibration, palette, options, chartLocalPalette, legend, textEvidence } = event.data;
    const detected = recognizeGridPatternFromPixels(imageData, calibration, palette, options, chartLocalPalette, profile);
    const localPalette = buildChartLocalPalette(chartLocalPalette ?? []);
    const confirmedLegend = Array.isArray(legend)
      && legend.length > 0
      && legend.every((entry: LegendEntry) => entry.confirmed && Number.isSafeInteger(entry.expectedCount) && entry.expectedCount >= 0);
    if (confirmedLegend) {
      const legendPalette = buildConfirmedLegendPalette(legend, localPalette.length ? localPalette : palette);
      const result = profile.time("legendCapacityAssignment", () => assignLegendCapacities(detected, legend, legendPalette, textEvidence));
      self.postMessage({
        grid: result.grid,
        recognitionMode: "legend-driven",
        assignmentSummary: result.summary,
        stages: profile.finish()
      });
      return;
    }
    self.postMessage({ grid: detected, recognitionMode: "image-driven", stages: profile.finish() });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "辨識失敗" });
  }
};
