import type { GridCalibration } from "../types/calibration";

export function CalibrationPanel({ calibration, onChange, onRecognize }: { calibration: GridCalibration | null; onChange: (next: GridCalibration) => void; onRecognize: () => void }) {
  if (!calibration) return <div className="panel"><p>請先上傳圖片並框選 3×3 校準區域。</p></div>;
  const crop = calibration.cropRange ?? { startRow: 0, endRow: Math.max(0, calibration.rows - 1), startCol: 0, endCol: Math.max(0, calibration.columns - 1) };
  const update = (key: keyof GridCalibration, value: number) => onChange({ ...calibration, [key]: value });
  const updateCrop = (key: keyof typeof crop, value: number) => {
    const next = { ...crop, [key]: Math.round(value) };
    next.startRow = Math.max(0, Math.min(next.startRow, calibration.rows - 1));
    next.endRow = Math.max(next.startRow, Math.min(next.endRow, calibration.rows - 1));
    next.startCol = Math.max(0, Math.min(next.startCol, calibration.columns - 1));
    next.endCol = Math.max(next.startCol, Math.min(next.endCol, calibration.columns - 1));
    onChange({ ...calibration, cropRange: next });
  };
  const cropRows = crop.endRow - crop.startRow + 1;
  const cropCols = crop.endCol - crop.startCol + 1;

  return (
    <div className="panel">
      <h3>格線微調</h3>
      <div className="grid-fields">
        {(["originX", "originY", "cellWidth", "cellHeight", "columns", "rows"] as Array<keyof GridCalibration>).map((key) => (
          <label key={key}>
            {label(key)}
            <input type="number" step={key.includes("Width") || key.includes("Height") || key.includes("origin") ? 0.1 : 1} value={Number(calibration[key])} onChange={(e) => update(key, Number(e.target.value))} />
          </label>
        ))}
      </div>
      <h3>辨識範圍</h3>
      <p>預覽範圍：{cropCols} × {cropRows}</p>
      <div className="grid-fields">
        <label>起始列<input type="number" min={1} max={calibration.rows} value={crop.startRow + 1} onChange={(e) => updateCrop("startRow", Number(e.target.value) - 1)} /></label>
        <label>結束列<input type="number" min={1} max={calibration.rows} value={crop.endRow + 1} onChange={(e) => updateCrop("endRow", Number(e.target.value) - 1)} /></label>
        <label>起始欄<input type="number" min={1} max={calibration.columns} value={crop.startCol + 1} onChange={(e) => updateCrop("startCol", Number(e.target.value) - 1)} /></label>
        <label>結束欄<input type="number" min={1} max={calibration.columns} value={crop.endCol + 1} onChange={(e) => updateCrop("endCol", Number(e.target.value) - 1)} /></label>
      </div>
      <div className="toolbar">
        <button onClick={() => updateCrop("startRow", crop.startRow - 1)}>上擴</button>
        <button onClick={() => updateCrop("startRow", crop.startRow + 1)}>上縮</button>
        <button onClick={() => updateCrop("endRow", crop.endRow + 1)}>下擴</button>
        <button onClick={() => updateCrop("endRow", crop.endRow - 1)}>下縮</button>
        <button onClick={() => updateCrop("startCol", crop.startCol - 1)}>左擴</button>
        <button onClick={() => updateCrop("startCol", crop.startCol + 1)}>左縮</button>
        <button onClick={() => updateCrop("endCol", crop.endCol + 1)}>右擴</button>
        <button onClick={() => updateCrop("endCol", crop.endCol - 1)}>右縮</button>
      </div>
      <button className="primary wide" onClick={onRecognize}>辨識圖紙</button>
    </div>
  );
}

function label(key: keyof GridCalibration) {
  return ({ originX: "起始 X", originY: "起始 Y", cellWidth: "格寬", cellHeight: "格高", columns: "欄數", rows: "列數" } as Partial<Record<keyof GridCalibration, string>>)[key] ?? key;
}
