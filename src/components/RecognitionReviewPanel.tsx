import type { PatternGrid } from "../types/pattern";

export function RecognitionReviewPanel({
  grid,
  threshold,
  onSelectColor
}: {
  grid: PatternGrid;
  threshold: number;
  onSelectColor: (code: string) => void;
}) {
  const cells = grid.flat().filter((cell) => !cell.empty && (cell.confidence ?? 1) < threshold).slice(0, 80);

  return (
    <div className="panel">
      <h3>低信心格子</h3>
      <p>{cells.length} 格低於 {Math.round(threshold * 100)}%</p>
      <div className="review-list">
        {cells.map((cell) => (
          <button key={`${cell.row}-${cell.col}`} onClick={() => onSelectColor(cell.colorCode)}>
            <strong>第 {cell.row + 1} 列 / 第 {cell.col + 1} 欄：{cell.colorCode}</strong>
            <span>來源：{cell.sourceRow == null ? "-" : cell.sourceRow + 1} / {cell.sourceCol == null ? "-" : cell.sourceCol + 1}</span>
            <span>信心 {Math.round((cell.confidence ?? 0) * 100)}% / 原色 {cell.rawHex ?? "-"} / 配色 {cell.matchedHex ?? cell.hex}</span>
            <span>H {cell.rawHue == null ? "-" : Math.round(cell.rawHue * 360)} / S {cell.rawSaturation == null ? "-" : cell.rawSaturation.toFixed(2)} / L {cell.rawLightness == null ? "-" : cell.rawLightness.toFixed(2)}</span>
            <span>
              候選：
              {cell.candidates?.map((item) =>
                `${item.code} score ${Math.round(item.adjustedDistance ?? item.distance)} H${item.hue == null ? "-" : Math.round(item.hue * 360)} S${item.saturation == null ? "-" : item.saturation.toFixed(2)} L${item.lightness == null ? "-" : item.lightness.toFixed(2)}`
              ).join("、") ?? "-"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
