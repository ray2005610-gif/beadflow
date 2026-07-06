import type { BeadColor } from "../types/bead";
import { mardPalette } from "./mardPalette";

export type ActiveMardPaletteOptions = {
  includePearl?: boolean;
  includeTransparent?: boolean;
  includeSpecial?: boolean;
  includeExtended?: boolean;
  includeUnknownFinish?: boolean;
};

export const defaultActiveMardPaletteOptions: Required<ActiveMardPaletteOptions> = {
  includePearl: false,
  includeTransparent: false,
  includeSpecial: false,
  includeExtended: true,
  includeUnknownFinish: true
};

export const mardColorMeta: Record<string, Pick<BeadColor,
  "finish" | "isTransparent" | "isPearl" | "isNeon" | "isGlitter" | "isSpecial" | "isStandard" | "isExtended" | "defaultUseInMatching" | "priorityPenalty" | "sourceNote"
>> = Object.fromEntries(mardPalette.map((color) => [color.code, {
  finish: color.finish,
  isTransparent: color.isTransparent,
  isPearl: color.isPearl,
  isNeon: color.isNeon,
  isGlitter: color.isGlitter,
  isSpecial: color.isSpecial,
  isStandard: color.isStandard,
  isExtended: color.isExtended,
  defaultUseInMatching: color.defaultUseInMatching,
  priorityPenalty: color.priorityPenalty,
  sourceNote: color.sourceNote
}]));

export function getActiveMardPalette(options: ActiveMardPaletteOptions = {}): BeadColor[] {
  const merged = { ...defaultActiveMardPaletteOptions, ...options };
  return mardPalette.filter((color) => {
    const finish = color.finish ?? "unknown";
    if (color.isPearl && !merged.includePearl) return false;
    if (color.isTransparent && !merged.includeTransparent) return false;
    if (color.isSpecial && !merged.includeSpecial) return false;
    if (color.isExtended && !merged.includeExtended) return false;
    if (finish === "unknown" && !merged.includeUnknownFinish) return false;
    return color.defaultUseInMatching !== false;
  });
}

export function validateMardPalette() {
  const codeSet = new Set<string>();
  const duplicateCodes: string[] = [];
  const invalidHex: string[] = [];
  const missingSeries: string[] = [];

  for (const color of mardPalette) {
    if (codeSet.has(color.code)) duplicateCodes.push(color.code);
    codeSet.add(color.code);
    if (!/^#[0-9A-F]{6}$/i.test(color.hex)) invalidHex.push(color.code);
    if (!color.series) missingSeries.push(color.code);
  }

  const activePalette = getActiveMardPalette();
  const pearlExcludedCount = mardPalette.filter((color) => color.isPearl && !activePalette.some((item) => item.code === color.code)).length;
  const transparentExcludedCount = mardPalette.filter((color) => color.isTransparent && !activePalette.some((item) => item.code === color.code)).length;
  const extensionColorsCount = activePalette.filter((color) => color.isExtended).length;
  const standardColorsCount = activePalette.filter((color) => color.isStandard).length;

  const result = {
    valid: duplicateCodes.length === 0 && invalidHex.length === 0 && missingSeries.length === 0 && mardPalette.length >= 291 && activePalette.length > 80,
    totalMardColors: mardPalette.length,
    activePaletteColors: activePalette.length,
    standardColorsCount,
    extensionColorsCount,
    pearlExcludedCount,
    transparentExcludedCount,
    duplicateCodes,
    invalidHex,
    missingSeries
  };

  if (typeof console !== "undefined") {
    console.info("[BeadFlow] MARD palette validation", result);
  }
  return result;
}

export const activeMardPalette = getActiveMardPalette();
export const mardPaletteValidation = validateMardPalette();
