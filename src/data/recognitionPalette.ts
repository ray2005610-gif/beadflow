import { mardPalette } from "./mardPalette";

export function getVisiblePalette() {
  return mardPalette.filter((color) => color.series !== "M");
}

export function getRecognitionPalette({ excludePearl = true }: { excludePearl?: boolean } = {}) {
  return excludePearl ? getVisiblePalette() : mardPalette;
}

export const visiblePalette = getVisiblePalette();
export const recognitionPalette = getRecognitionPalette({ excludePearl: true });
