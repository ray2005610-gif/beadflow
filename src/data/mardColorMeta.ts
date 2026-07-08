import type { BeadColor } from "../types/bead";
import { mardPalette } from "./mardPalette";

export type ActiveMardPaletteOptions = {
  includeSpecial?: boolean;
};

const recognitionSeries = new Set(["A", "B", "C", "D", "E", "F", "G", "H", "K", "L", "M"]);

export const mardColorMeta: Record<string, Pick<BeadColor,
  "finish" | "isTransparent" | "isPearl" | "isNeon" | "isGlitter" | "isSpecial" | "isStandard" | "isExtended" | "defaultUseInMatching" | "defaultUseInRecognition" | "defaultUseInAutoMatching" | "canUseManually" | "specialLabel" | "priorityPenalty" | "sourceNote"
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
  defaultUseInRecognition: color.defaultUseInRecognition,
  defaultUseInAutoMatching: color.defaultUseInAutoMatching,
  canUseManually: color.canUseManually,
  specialLabel: color.specialLabel,
  priorityPenalty: color.priorityPenalty,
  sourceNote: color.sourceNote
}]));

export function isRecognitionStandardMardColor(color: BeadColor): boolean {
  const series = color.series ?? color.code.match(/^[A-Z]+/)?.[0] ?? "";
  return recognitionSeries.has(series)
    && !color.isTransparent
    && !color.isSpecial
    && color.defaultUseInRecognition !== false
    && color.defaultUseInAutoMatching !== false
    && color.defaultUseInMatching !== false;
}

export function getRecognitionMardPalette(): BeadColor[] {
  return mardPalette.filter(isRecognitionStandardMardColor);
}

export function getDisplayMardPalette(): BeadColor[] {
  return mardPalette.filter((color) => color.canUseManually !== false);
}

export function getActiveMardPalette(options: ActiveMardPaletteOptions = {}): BeadColor[] {
  return options.includeSpecial ? getDisplayMardPalette() : getRecognitionMardPalette();
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

  const recognitionPalette = getRecognitionMardPalette();
  const displayPalette = getDisplayMardPalette();
  const excludedRecognitionSeries = Array.from(new Set(
    recognitionPalette.map((color) => color.series).filter((series): series is string => Boolean(series && !recognitionSeries.has(series)))
  ));
  const specialExcludedCount = mardPalette.filter((color) => color.isSpecial && !recognitionPalette.some((item) => item.code === color.code)).length;
  const transparentExcludedCount = mardPalette.filter((color) => color.isTransparent && !recognitionPalette.some((item) => item.code === color.code)).length;

  const result = {
    valid: duplicateCodes.length === 0 && invalidHex.length === 0 && missingSeries.length === 0 && mardPalette.length >= 291 && recognitionPalette.length > 80 && excludedRecognitionSeries.length === 0,
    totalMardColors: mardPalette.length,
    recognitionPaletteColors: recognitionPalette.length,
    displayPaletteColors: displayPalette.length,
    standardColorsCount: recognitionPalette.length,
    specialExcludedCount,
    transparentExcludedCount,
    excludedRecognitionSeries,
    duplicateCodes,
    invalidHex,
    missingSeries
  };

  if (typeof console !== "undefined") {
    console.info("[BeadFlow] MARD palette validation", result);
  }
  return result;
}

export const activeMardPalette = getRecognitionMardPalette();
export const mardPaletteValidation = validateMardPalette();
