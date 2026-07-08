import { mardPalette } from "./mardPalette";
import { getDisplayMardPalette, getRecognitionMardPalette, type ActiveMardPaletteOptions } from "./mardColorMeta";

export function getVisiblePalette(_options: ActiveMardPaletteOptions = {}) {
  return getDisplayMardPalette();
}

export function getRecognitionPalette(_options: ActiveMardPaletteOptions = {}) {
  return getRecognitionMardPalette();
}

export const visiblePalette = getVisiblePalette();
export const displayPalette = visiblePalette;
export const recognitionPalette = getRecognitionPalette();
export const allMardPalette = mardPalette;
