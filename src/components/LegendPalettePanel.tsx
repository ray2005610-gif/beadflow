import type { ChartLocalPaletteEntry } from "../types/calibration";
import { mardPalette, mardPaletteByCode } from "../data/mardPalette";

export function LegendPalettePanel({
  entries,
  detecting,
  onDetect,
  onChange
}: {
  entries: ChartLocalPaletteEntry[];
  detecting: boolean;
  onDetect: () => void;
  onChange: (entries: ChartLocalPaletteEntry[]) => void;
}) {
  const update = (id: string, patch: Partial<ChartLocalPaletteEntry>) => {
    onChange(entries.map((entry) => {
      if (entry.id !== id) return entry;
      const next = { ...entry, ...patch };
      if (patch.code !== undefined) {
        const code = patch.code.trim().toUpperCase();
        const official = mardPaletteByCode.get(code);
        next.code = code;
        next.officialHex = official?.hex;
      }
      return next;
    }));
  };

  const add = () => {
    onChange([...entries, {
      id: crypto.randomUUID(),
      code: "",
      sampledHex: "#D8D8D8",
      source: "legend",
      confidence: 1,
      enabled: true
    }]);
  };

  const activeCount = entries.filter((entry) => entry.enabled && entry.code).length;

  return (
    <details className="panel">
      <summary><strong>圖紙色表校正</strong>{activeCount > 0 ? `（已設定 ${activeCount} 色）` : ""}</summary>
      <p>先偵測圖片下方的色塊，再填入圖紙上標示的色號。辨識時只會使用已啟用且有色號的項目。</p>
      <div className="toolbar compact-toolbar">
        <button type="button" onClick={onDetect} disabled={detecting}>{detecting ? "正在偵測…" : "偵測圖中色塊"}</button>
        <button type="button" onClick={add}>新增色號</button>
        {entries.length > 0 && <button type="button" onClick={() => onChange([])}>清除色表</button>}
      </div>
      <datalist id="mard-color-codes">
        <option value="TRANSPARENT">透明 / 空白</option>
        {mardPalette.map((color) => <option key={color.code} value={color.code}>{color.name}</option>)}
      </datalist>
      {entries.length === 0 ? (
        <p>尚未建立圖紙專用色卡。辨識時會使用 MARD 標準辨識色卡。</p>
      ) : (
        <div className="legend-palette-list">
          {entries.map((entry, index) => (
            <div className="legend-palette-row" key={entry.id}>
              <input
                type="checkbox"
                checked={entry.enabled}
                aria-label={`啟用色塊 ${index + 1}`}
                onChange={(event) => update(entry.id, { enabled: event.target.checked })}
              />
              <input
                type="color"
                value={entry.sampledHex}
                aria-label={`色塊 ${index + 1} 取樣色`}
                onChange={(event) => update(entry.id, { sampledHex: event.target.value.toUpperCase() })}
              />
              <input
                list="mard-color-codes"
                value={entry.code}
                placeholder="色號，例如 B13"
                aria-label={`色塊 ${index + 1} 色號`}
                onChange={(event) => update(entry.id, { code: event.target.value })}
              />
              <input
                type="number"
                min={0}
                value={entry.countFromLegend ?? ""}
                placeholder="顆數"
                aria-label={`色塊 ${index + 1} 顆數`}
                onChange={(event) => update(entry.id, { countFromLegend: event.target.value ? Number(event.target.value) : undefined })}
              />
              <button type="button" aria-label={`刪除色塊 ${index + 1}`} onClick={() => onChange(entries.filter((item) => item.id !== entry.id))}>刪除</button>
            </div>
          ))}
        </div>
      )}
      {activeCount > 0 && <p>已套用本圖專用色卡；按「辨識圖紙」即可重新辨識。</p>}
    </details>
  );
}
