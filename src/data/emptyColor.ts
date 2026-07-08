import type { BeadColor } from "../types/bead";
import type { PatternCell } from "../types/pattern";

export const EMPTY_COLOR_CODE = "TRANSPARENT";

export const EMPTY_COLOR: BeadColor = {
  code: EMPTY_COLOR_CODE,
  name: "透明 / 空白",
  hex: "transparent",
  symbol: "",
  series: "EMPTY",
  brand: "BeadFlow",
  finish: "transparent",
  isTransparent: true,
  isSpecial: true,
  isStandard: false,
  defaultUseInMatching: false,
  defaultUseInRecognition: false,
  defaultUseInAutoMatching: false,
  canUseManually: true,
  specialLabel: "空白"
};

export function isEmptyColorCode(code?: string | null): boolean {
  return !code || code === EMPTY_COLOR_CODE || code === "EMPTY";
}

export function isEmptyOrTransparentCell(cell: Pick<PatternCell, "empty" | "colorCode">): boolean {
  return cell.empty === true || isEmptyColorCode(cell.colorCode);
}

export function normalizeEmptyCell(cell: PatternCell): PatternCell {
  if (!isEmptyOrTransparentCell(cell)) return cell;
  return {
    ...cell,
    colorCode: EMPTY_COLOR.code,
    colorName: EMPTY_COLOR.name,
    hex: EMPTY_COLOR.hex,
    symbol: EMPTY_COLOR.symbol,
    empty: true,
    done: false
  };
}
