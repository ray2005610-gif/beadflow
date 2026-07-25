import type { BeadColor } from "../types/bead";

export type MardCalibratedColor = {
  code: string;
  hex: string;
  sourceType: "user-calibrated" | "measured";
  sourceName?: string;
  measuredUnder?: string;
  updatedAt: string;
};

const STORAGE_KEY = "beadflow:mard-calibrated-colors";

export function loadMardCalibrations(): Record<string, MardCalibratedColor> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, MardCalibratedColor>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, item]) => item && isHex(item.hex) && Boolean(item.code))
    );
  } catch {
    return {};
  }
}

export function applyMardCalibrations(
  palette: BeadColor[],
  calibrations: Record<string, MardCalibratedColor>
): BeadColor[] {
  return palette.map((color) => {
    const calibrated = calibrations[color.code];
    return {
      ...color,
      displayHex: color.hex,
      referenceHex: color.referenceHex ?? color.hex,
      calibratedHex: calibrated?.hex,
      matchHex: calibrated?.hex ?? color.matchHex ?? color.referenceHex ?? color.hex,
      sourceType: calibrated?.sourceType ?? color.sourceType ?? "existing-reference",
      sourceName: calibrated?.sourceName ?? color.sourceName,
      measuredUnder: calibrated?.measuredUnder ?? color.measuredUnder,
      updatedAt: calibrated?.updatedAt ?? color.updatedAt
    };
  });
}

export function getMardCalibrationCount(calibrations: Record<string, MardCalibratedColor>): number {
  return Object.keys(calibrations).length;
}

function isHex(value: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(value);
}
