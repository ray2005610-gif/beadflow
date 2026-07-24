import { useMemo, useState } from "react";
import type { ChartLocalPaletteEntry, GridRecognitionPaletteMode } from "../types/calibration";
import { mardPalette, mardPaletteByCode } from "../data/mardPalette";
import { recognitionPalette } from "../data/recognitionPalette";

export function LegendPalettePanel({
  entries,
  detecting,
  paletteMode,
  onPaletteModeChange,
  onDetect,
  onChange
}: {
  entries: ChartLocalPaletteEntry[];
  detecting: boolean;
  paletteMode: GridRecognitionPaletteMode;
  onPaletteModeChange: (mode: GridRecognitionPaletteMode) => void;
  onDetect: () => void;
  onChange: (entries: ChartLocalPaletteEntry[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [series, setSeries] = useState("all");
  const activeEntries = getUniqueValidEntries(entries);
  const legendCount = getUniqueValidEntries(entries.filter((entry) => entry.source === "legend")).length;
  const customCount = getUniqueValidEntries(entries.filter((entry) => entry.source === "manual")).length;

  const seriesList = useMemo(() => {
    return Array.from(new Set(mardPalette.map((color) => color.series ?? color.code[0]).filter(Boolean))).sort();
  }, []);

  const filteredPalette = useMemo(() => {
    const normalized = query.trim().toUpperCase();
    return mardPalette
      .filter((color) => series === "all" || color.series === series || color.code.startsWith(series))
      .filter((color) => !normalized || color.code.includes(normalized) || color.name.toUpperCase().includes(normalized))
      .slice(0, 80);
  }, [query, series]);

  const update = (id: string, patch: Partial<ChartLocalPaletteEntry>) => {
    onChange(entries.map((entry) => {
      if (entry.id !== id) return entry;
      const next = { ...entry, ...patch };
      if (patch.code !== undefined) {
        const code = patch.code.trim().toUpperCase();
        const official = mardPaletteByCode.get(code);
        next.code = code;
        next.officialHex = official?.hex;
        if (official && entry.source === "manual") next.sampledHex = official.hex;
      }
      return next;
    }));
  };

  const addManualColor = (code: string) => {
    const normalized = code.trim().toUpperCase();
    const color = mardPaletteByCode.get(normalized);
    if (!color) return;
    const exists = entries.some((entry) => entry.code.trim().toUpperCase() === normalized);
    if (exists) {
      onChange(entries.map((entry) => entry.code.trim().toUpperCase() === normalized ? { ...entry, enabled: true } : entry));
      return;
    }
    onChange([...entries, {
      id: crypto.randomUUID(),
      code: color.code,
      sampledHex: color.hex,
      officialHex: color.hex,
      source: "manual",
      confidence: 1,
      enabled: true
    }]);
  };

  const addBlankLegend = () => {
    onChange([...entries, {
      id: crypto.randomUUID(),
      code: "",
      sampledHex: "#D8D8D8",
      source: "legend",
      confidence: 1,
      enabled: true
    }]);
  };

  const restoreLegend = () => {
    onChange(entries.map((entry) => entry.source === "legend" ? { ...entry, enabled: true } : entry));
    onPaletteModeChange("legend");
  };

  return (
    <details className="panel" open>
      <summary><strong>辨識色號範圍</strong>{activeEntries.length > 0 ? `（已啟用 ${activeEntries.length} 色）` : ""}</summary>
      <div className="stacked-options">
        <label className="radio-card">
          <input type="radio" checked={paletteMode === "all"} onChange={() => onPaletteModeChange("all")} />
          <span><strong>所有 MARD 標準色</strong><small>使用原本的自動辨識候選色。</small></span>
        </label>
        <label className="radio-card">
          <input type="radio" checked={paletteMode === "legend"} onChange={() => onPaletteModeChange("legend")} />
          <span><strong>使用圖紙底部色號</strong><small>推薦，已辨識 {legendCount} 色。</small></span>
        </label>
        <label className="radio-card">
          <input type="radio" checked={paletteMode === "custom"} onChange={() => onPaletteModeChange("custom")} />
          <span><strong>自訂色號</strong><small>已選擇 {customCount} 色，可手動加入特殊色。</small></span>
        </label>
      </div>

      <div className="toolbar compact-toolbar">
        <button type="button" onClick={onDetect} disabled={detecting}>{detecting ? "辨識中..." : "辨識底部色塊"}</button>
        <button type="button" onClick={addBlankLegend}>新增底部色號</button>
        <button type="button" onClick={() => onChange(entries.map((entry) => ({ ...entry, enabled: true })))} disabled={!entries.length}>全選</button>
        <button type="button" onClick={() => onChange(entries.map((entry) => ({ ...entry, enabled: false })))} disabled={!entries.length}>全部取消</button>
        <button type="button" onClick={restoreLegend} disabled={!entries.some((entry) => entry.source === "legend")}>恢復底部結果</button>
      </div>

      {entries.length === 0 ? (
        <p className="muted-note">尚未建立已知色號。可以先辨識底部色塊，或用下方色卡手動新增。</p>
      ) : (
        <div className="legend-palette-list">
          {entries.map((entry, index) => {
            const official = mardPaletteByCode.get(entry.code.trim().toUpperCase());
            return (
              <div className="legend-palette-row" key={entry.id}>
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  aria-label={`啟用色號 ${index + 1}`}
                  onChange={(event) => update(entry.id, { enabled: event.target.checked })}
                />
                <input
                  type="color"
                  value={entry.sampledHex}
                  aria-label={`色號 ${index + 1} 圖紙取樣色`}
                  onChange={(event) => update(entry.id, { sampledHex: event.target.value.toUpperCase() })}
                />
                <input
                  list="mard-color-codes"
                  value={entry.code}
                  placeholder="色號，例如 B13"
                  aria-label={`色號 ${index + 1}`}
                  onChange={(event) => update(entry.id, { code: event.target.value })}
                />
                <span className="legend-source">{entry.source === "legend" ? "底部" : "手動"}</span>
                <span className={official ? "legend-valid" : "legend-invalid"}>{official ? official.series ?? official.code[0] : "無效"}</span>
                <button type="button" aria-label={`移除色號 ${index + 1}`} onClick={() => onChange(entries.filter((item) => item.id !== entry.id))}>移除</button>
              </div>
            );
          })}
        </div>
      )}

      <datalist id="mard-color-codes">
        {mardPalette.map((color) => <option key={color.code} value={color.code}>{color.name}</option>)}
      </datalist>

      <div className="known-color-picker">
        <div className="grid-fields">
          <label>搜尋色號<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="A01 / B13" /></label>
          <label>系列
            <select value={series} onChange={(event) => setSeries(event.target.value)}>
              <option value="all">全部系列</option>
              {seriesList.map((item) => <option key={item} value={item}>{item} 系列</option>)}
            </select>
          </label>
        </div>
        <div className="known-color-grid">
          {filteredPalette.map((color) => {
            const added = entries.some((entry) => entry.code.trim().toUpperCase() === color.code && entry.enabled);
            const isStandardCandidate = recognitionPalette.some((item) => item.code === color.code);
            return (
              <button
                type="button"
                key={color.code}
                className={added ? "active" : ""}
                onClick={() => addManualColor(color.code)}
                title={isStandardCandidate ? color.name : `${color.name}，手動加入才會參與本張圖辨識`}
              >
                <span className="swatch" style={{ background: color.hex }} />
                <span>{color.code}</span>
              </button>
            );
          })}
        </div>
      </div>

      {paletteMode !== "all" && activeEntries.length === 0 && (
        <p className="warning-note">尚未選擇任何有效色號。請手動新增色號，或切回「所有 MARD 標準色」。</p>
      )}
    </details>
  );
}

function getUniqueValidEntries(entries: ChartLocalPaletteEntry[]): ChartLocalPaletteEntry[] {
  const unique = new Map<string, ChartLocalPaletteEntry>();
  for (const entry of entries) {
    const code = entry.code.trim().toUpperCase();
    if (!entry.enabled || !code || code === "TRANSPARENT" || code === "EMPTY" || !mardPaletteByCode.has(code)) continue;
    if (!unique.has(code)) unique.set(code, entry);
  }
  return Array.from(unique.values());
}
