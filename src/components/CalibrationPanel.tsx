import type { GridCalibration } from "../types/calibration";

type CropRange = NonNullable<GridCalibration["cropRange"]>;

export function CalibrationPanel({
  calibration,
  onChange,
  onRecognize
}: {
  calibration: GridCalibration | null;
  onChange: (next: GridCalibration) => void;
  onRecognize: () => void;
}) {
  if (!calibration) return <div className="panel"><p>請上傳圖片，並框選 3×3 格子校準區域。</p></div>;

  const crop = calibration.cropRange ?? {
    startRow: 0,
    endRow: Math.max(0, calibration.rows - 1),
    startCol: 0,
    endCol: Math.max(0, calibration.columns - 1)
  };
  const cropRows = crop.endRow - crop.startRow + 1;
  const cropCols = crop.endCol - crop.startCol + 1;

  const update = (key: keyof GridCalibration, value: number) => {
    const next = { ...calibration, [key]: value };
    if (key === "columns" || key === "rows") {
      next.cropRange = clampCrop(crop, Number(next.rows), Number(next.columns));
    }
    onChange(next);
  };

  const updateCrop = (key: keyof CropRange, value: number) => {
    onChange({ ...calibration, cropRange: clampCrop({ ...crop, [key]: Math.round(value) }, calibration.rows, calibration.columns) });
  };

  return (
    <div className="panel">
      <h3>格線微調</h3>
      <div className="grid-fields">
        {(["originX", "originY", "cellWidth", "cellHeight", "columns", "rows"] as Array<keyof GridCalibration>).map((key) => (
          <label key={key}>
            {label(key)}
            <input
              type="number"
              step={key.includes("Width") || key.includes("Height") || key.includes("origin") ? 0.1 : 1}
              value={Number(calibration[key])}
              onChange={(event) => update(key, Number(event.target.value))}
            />
          </label>
        ))}
      </div>
      <h3>辨識裁切範圍</h3>
      <p>目前辨識範圍：{cropCols} 欄 × {cropRows} 列。裁切範圍外不會進入圖紙與統計。</p>
      <div className="grid-fields">
        <label>起始列<input type="number" min={1} max={calibration.rows} value={crop.startRow + 1} onChange={(event) => updateCrop("startRow", Number(event.target.value) - 1)} /></label>
        <label>結束列<input type="number" min={1} max={calibration.rows} value={crop.endRow + 1} onChange={(event) => updateCrop("endRow", Number(event.target.value) - 1)} /></label>
        <label>起始欄<input type="number" min={1} max={calibration.columns} value={crop.startCol + 1} onChange={(event) => updateCrop("startCol", Number(event.target.value) - 1)} /></label>
        <label>結束欄<input type="number" min={1} max={calibration.columns} value={crop.endCol + 1} onChange={(event) => updateCrop("endCol", Number(event.target.value) - 1)} /></label>
      </div>
      <div className="toolbar compact-toolbar">
        <button onClick={() => updateCrop("startRow", crop.startRow - 1)}>上緣外擴</button>
        <button onClick={() => updateCrop("startRow", crop.startRow + 1)}>上緣內縮</button>
        <button onClick={() => updateCrop("endRow", crop.endRow + 1)}>下緣外擴</button>
        <button onClick={() => updateCrop("endRow", crop.endRow - 1)}>下緣內縮</button>
        <button onClick={() => updateCrop("startCol", crop.startCol - 1)}>左緣外擴</button>
        <button onClick={() => updateCrop("startCol", crop.startCol + 1)}>左緣內縮</button>
        <button onClick={() => updateCrop("endCol", crop.endCol + 1)}>右緣外擴</button>
        <button onClick={() => updateCrop("endCol", crop.endCol - 1)}>右緣內縮</button>
      </div>
      <button className="primary wide" onClick={onRecognize}>辨識圖紙</button>
    </div>
  );
}

function clampCrop(crop: CropRange, rows: number, columns: number): CropRange {
  const maxRow = Math.max(0, Math.round(rows) - 1);
  const maxCol = Math.max(0, Math.round(columns) - 1);
  const startRow = Math.max(0, Math.min(crop.startRow, maxRow));
  const endRow = Math.max(startRow, Math.min(crop.endRow, maxRow));
  const startCol = Math.max(0, Math.min(crop.startCol, maxCol));
  const endCol = Math.max(startCol, Math.min(crop.endCol, maxCol));
  return { startRow, endRow, startCol, endCol };
}

function label(key: keyof GridCalibration) {
  return ({
    originX: "起點 X",
    originY: "起點 Y",
    cellWidth: "格寬",
    cellHeight: "格高",
    columns: "欄數",
    rows: "列數"
  } as Partial<Record<keyof GridCalibration, string>>)[key] ?? key;
}
