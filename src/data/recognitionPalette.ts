import { mardPalette } from "./mardPalette";
import { getActiveMardPalette, type ActiveMardPaletteOptions } from "./mardColorMeta";

export function getVisiblePalette(options: ActiveMardPaletteOptions = {}) {
  return getActiveMardPalette(options);
}

export function getRecognitionPalette(options: ActiveMardPaletteOptions = {}) {
  return getActiveMardPalette(options);
}

export const visiblePalette = getVisiblePalette();
export const recognitionPalette = getRecognitionPalette();
export const allMardPalette = mardPalette;
