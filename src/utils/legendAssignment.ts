import type { BeadColor, RGB } from "../types/bead";
import type { GridTextEvidence, LegendAssignmentSummary, LegendEntry } from "../types/legend";
import type { PatternCell, PatternGrid } from "../types/pattern";
import { mardPaletteByCode } from "../data/mardPalette";
import { isEmptyOrTransparentCell } from "../data/emptyColor";
import { deltaE2000, hexToRgb, rgbToLab } from "./colorUtils";

type CellCost = {
  code: string;
  colorCost: number;
  textCost: number;
  totalCost: number;
  color: BeadColor;
};

export type LegendAssignmentResult = {
  grid: PatternGrid;
  summary: LegendAssignmentSummary;
};

export function buildConfirmedLegendPalette(legend: LegendEntry[], available: BeadColor[]): BeadColor[] {
  const availableByCode = new Map(available.map((color) => [color.code.toUpperCase(), color]));
  const result = new Map<string, BeadColor>();
  for (const entry of legend) {
    const code = entry.colorCode.trim().toUpperCase();
    const official = availableByCode.get(code);
    if (!entry.confirmed || !official || !Number.isSafeInteger(entry.expectedCount) || entry.expectedCount < 0) continue;
    const sampled = entry.sampledColor ?? entry.swatchColor;
    result.set(code, sampled && /^#[0-9A-F]{6}$/i.test(sampled)
      ? { ...official, matchHex: sampled }
      : official);
  }
  return [...result.values()];
}

export function assignLegendCapacities(
  sourceGrid: PatternGrid,
  legend: LegendEntry[],
  localPalette: BeadColor[],
  textEvidence: GridTextEvidence[] = []
): LegendAssignmentResult {
  const expectedByCode = new Map(legend.map((entry) => [entry.colorCode.trim().toUpperCase(), entry.expectedCount]));
  const expectedTotal = [...expectedByCode.values()].reduce((sum, count) => sum + count, 0);
  const localByCode = new Map(localPalette.map((color) => [color.code.toUpperCase(), color]));
  const confirmedCodes = [...expectedByCode.keys()].filter((code) => localByCode.has(code));
  if (!confirmedCodes.length) throw new Error("已確認圖例沒有可用的標準 MARD 色號");

  const evidenceByCell = new Map(textEvidence.map((item) => [`${item.sourceRow}:${item.sourceCol}`, item]));
  const flat = sourceGrid.flat();
  const normalValid = flat.filter((cell) => !isEmptyOrTransparentCell(cell));
  const recoverable = flat.filter((cell) => cell.rawRgb && (cell.alpha ?? 255) > 20);
  // A full-board confirmed total is stronger evidence than a near-white background heuristic.
  // This is what keeps real H2/white beads from disappearing.
  const assignable = expectedTotal === recoverable.length ? recoverable : normalValid;
  const detectedValidCells = assignable.length;
  const totalsMatch = expectedTotal === detectedValidCells;
  const assignableKeys = new Set(assignable.map(cellKey));
  const costs = new Map<string, CellCost[]>();
  const initialAssignment = new Map<string, string>();

  for (const cell of assignable) {
    const rgb = cell.rawRgb ?? hexToRgb(cell.hex);
    const evidence = evidenceByCell.get(`${cell.sourceRow ?? cell.row}:${cell.sourceCol ?? cell.col}`);
    const ranked = rankCellCandidates(rgb, evidence, confirmedCodes.map((code) => localByCode.get(code)!));
    costs.set(cellKey(cell), ranked);
    initialAssignment.set(cellKey(cell), ranked[0].code);
  }

  const assignment = new Map(initialAssignment);
  if (totalsMatch) balanceToExactCounts(assignment, costs, expectedByCode);

  let lowConfidenceCount = 0;
  const grid = sourceGrid.map((row) => row.map((cell) => {
    const key = cellKey(cell);
    if (!assignableKeys.has(key)) return cell;
    const ranked = costs.get(key)!;
    const assignedCode = assignment.get(key)!;
    const assigned = ranked.find((candidate) => candidate.code === assignedCode)!;
    const best = ranked[0];
    const second = ranked[1] ?? ranked[0];
    const forcedDelta = Math.max(0, assigned.totalCost - best.totalCost);
    const bestMargin = Math.max(0, second.totalCost - best.totalCost);
    const confidence = assignedCode === best.code
      ? clamp(0.5 + bestMargin / 16, 0.5, 0.99)
      : clamp(0.7 - forcedDelta / 22, 0.08, 0.7);
    const suspicious = confidence < 0.65 || forcedDelta > 3;
    if (suspicious) lowConfidenceCount += 1;
    const official = mardPaletteByCode.get(assignedCode) ?? assigned.color;
    const evidence = evidenceByCell.get(`${cell.sourceRow ?? cell.row}:${cell.sourceCol ?? cell.col}`);
    return {
      ...cell,
      colorCode: official.code,
      colorName: official.name,
      hex: official.hex,
      symbol: official.symbol,
      empty: false,
      done: false,
      rawDetectedColor: best.code,
      finalDetectedColor: assignedCode,
      correctionReason: assignedCode === best.code ? cell.correctionReason : "legend",
      suspectedMismatch: suspicious,
      confidence,
      sampledColor: cell.rawRgb,
      textCandidate: evidence?.textCandidate,
      textConfidence: evidence?.textConfidence,
      bestColorCost: best.totalCost,
      secondBestColorCost: second.totalCost,
      assignedColorCost: assigned.totalCost,
      candidateMargin: bestMargin,
      distance: assigned.colorCost,
      adjustedDistance: assigned.totalCost,
      matchedHex: assigned.color.matchHex ?? assigned.color.hex,
      candidates: ranked.slice(0, 8).map((candidate) => ({
        code: candidate.code,
        hex: candidate.color.hex,
        distance: candidate.colorCost,
        adjustedDistance: candidate.totalCost,
        colorCost: candidate.colorCost,
        textCost: candidate.textCost,
        totalCost: candidate.totalCost
      }))
    };
  }));

  assertLocalPaletteInvariant(grid, new Set(confirmedCodes));
  if (totalsMatch) assertExactCounts(grid, expectedByCode);
  return {
    grid,
    summary: {
      mode: "legend-driven",
      expectedTotal,
      detectedValidCells,
      difference: detectedValidCells - expectedTotal,
      totalsMatch,
      constraintApplied: totalsMatch,
      lowConfidenceCount
    }
  };
}

function rankCellCandidates(rgb: RGB, evidence: GridTextEvidence | undefined, palette: BeadColor[]): CellCost[] {
  const sourceLab = rgbToLab(rgb);
  const acceptedText = evidence && palette.some((color) => color.code === evidence.textCandidate)
    ? evidence
    : undefined;
  return palette.map((color) => {
    const targetHex = color.matchHex ?? color.calibratedHex ?? color.referenceHex ?? color.hex;
    const colorCost = deltaE2000(sourceLab, rgbToLab(hexToRgb(targetHex)));
    const textWeight = acceptedText ? clamp(acceptedText.textConfidence, 0, 1) : 0;
    const textCost = acceptedText
      ? (acceptedText.textCandidate === color.code ? -6 * textWeight : 2.5 * textWeight)
      : 0;
    return { code: color.code, colorCost, textCost, totalCost: colorCost + textCost, color };
  }).sort((a, b) => a.totalCost - b.totalCost || a.code.localeCompare(b.code));
}

function balanceToExactCounts(
  assignment: Map<string, string>,
  costs: Map<string, CellCost[]>,
  expectedByCode: Map<string, number>
) {
  const counts = new Map<string, number>();
  for (const code of assignment.values()) counts.set(code, (counts.get(code) ?? 0) + 1);
  const surplus = new Map<string, number>();
  const deficit = new Map<string, number>();
  for (const [code, expected] of expectedByCode) {
    const actual = counts.get(code) ?? 0;
    if (actual > expected) surplus.set(code, actual - expected);
    if (actual < expected) deficit.set(code, expected - actual);
  }
  const moves: Array<{ key: string; from: string; to: string; delta: number }> = [];
  for (const [key, from] of assignment) {
    if (!(surplus.get(from) ?? 0)) continue;
    const ranked = costs.get(key)!;
    const current = ranked.find((candidate) => candidate.code === from)!;
    for (const [to, missing] of deficit) {
      if (!missing) continue;
      const alternative = ranked.find((candidate) => candidate.code === to)!;
      moves.push({ key, from, to, delta: alternative.totalCost - current.totalCost });
    }
  }
  moves.sort((a, b) => a.delta - b.delta || a.key.localeCompare(b.key));
  for (const move of moves) {
    if (assignment.get(move.key) !== move.from || !(surplus.get(move.from) ?? 0) || !(deficit.get(move.to) ?? 0)) continue;
    assignment.set(move.key, move.to);
    surplus.set(move.from, surplus.get(move.from)! - 1);
    deficit.set(move.to, deficit.get(move.to)! - 1);
  }
  if ([...surplus.values()].some(Boolean) || [...deficit.values()].some(Boolean)) {
    throw new Error("圖例顆數分配失敗，請檢查圖例與辨識範圍");
  }
}

function assertLocalPaletteInvariant(grid: PatternGrid, allowed: Set<string>) {
  const illegal = grid.flat().find((cell) => !isEmptyOrTransparentCell(cell) && !allowed.has(cell.colorCode));
  if (illegal) throw new Error(`圖例限制失效：辨識出未列於圖例的 ${illegal.colorCode}`);
}

function assertExactCounts(grid: PatternGrid, expectedByCode: Map<string, number>) {
  const actual = new Map<string, number>();
  for (const cell of grid.flat()) if (!isEmptyOrTransparentCell(cell)) actual.set(cell.colorCode, (actual.get(cell.colorCode) ?? 0) + 1);
  for (const [code, expected] of expectedByCode) {
    if ((actual.get(code) ?? 0) !== expected) throw new Error(`圖例顆數約束未達成：${code}`);
  }
}

function cellKey(cell: PatternCell) {
  return `${cell.row}:${cell.col}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
