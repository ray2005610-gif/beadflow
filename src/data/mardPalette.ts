import type { BeadColor } from "../types/bead";
import rawMardColors from "./mard_palette_291_pixel_beads.json";

type RawMardColor = Omit<BeadColor, "name" | "symbol"> & {
  paletteVersion: string;
  nameZh: string;
  nameEn: string;
};

export const MARD_PALETTE_VERSION = "MARD_291_PIXEL_BEADS";

export const mardPalette: BeadColor[] = (rawMardColors as RawMardColor[]).map((color) => ({
  ...color,
  name: color.nameZh || color.nameEn || `MARD ${color.code}`,
  symbol: color.code,
  series: color.series ?? color.code.match(/^[A-Z]+/)?.[0] ?? color.code[0],
  brand: "MARD"
}));

export const mardPaletteByCode = new Map(mardPalette.map((color) => [color.code, color]));
