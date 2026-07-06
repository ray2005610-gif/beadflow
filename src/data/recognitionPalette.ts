import { mardPalette } from "./mardPalette";

export function getRecognitionPalette({ excludePearl = true }: { excludePearl?: boolean } = {}) {
  return excludePearl ? mardPalette.filter((color) => color.series !== "M") : mardPalette;
}

export const recognitionPalette = getRecognitionPalette({ excludePearl: true });
