import { useMemo, useState } from "react";
import type { ChartLocalPaletteEntry, GridRecognitionPaletteMode } from "../types/calibration";
import { mardPalette, mardPaletteByCode } from "../data/mardPalette";
import { recognitionPalette } from "../data/recognitionPalette";

type ImportReport = {
  added: string[];
  duplicates: string[];
  invalid: string[];
};

export function LegendPalettePanel({
  entries,
  paletteMode,
  onPaletteModeChange,
  onChange
}: {
  entries: ChartLocalPaletteEntry[];
  paletteMode: GridRecognitionPaletteMode;
  onPaletteModeChange: (mode: GridRecognitionPaletteMode) => void;
  onChange: (entries: ChartLocalPaletteEntry[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [series, setSeries] = useState("all");
  const [bulkText, setBulkText] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const activeEntries = getUniqueValidEntries(entries);

  const recognitionCodeSet = useMemo(() => new Set(recognitionPalette.map((color) => color.code)), []);
  const seriesList = useMemo(() => {
    return Array.from(new Set(mardPalette.map((color) => color.series ?? color.code[0]).filter(Boolean))).sort();
  }, []);

  const filteredPalette = useMemo(() => {
    const normalized = query.trim().toUpperCase();
    return mardPalette
      .filter((color) => series === "all" || color.series === series || color.code.startsWith(series))
      .filter((color) => !normalized || color.code.includes(normalized) || color.name.toUpperCase().includes(normalized))
      .slice(0, 96);
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
        next.sampledHex = official?.hex ?? next.sampledHex;
      }
      return next;
    }));
  };

  const addManualColor = (code: string) => {
    const result = importCodes([code], entries);
    onChange(result.entries);
    setReport(result.report);
    if (result.report.added.length > 0) onPaletteModeChange("manual-known");
  };

  const importBulkCodes = () => {
    const codes = parseColorCodes(bulkText);
    const result = importCodes(codes, entries);
    onChange(result.entries);
    setReport(result.report);
    if (result.report.added.length > 0 || result.entries.some((entry) => entry.enabled)) {
      onPaletteModeChange("manual-known");
    }
  };

  return (
    <details className="panel" open>
      <summary>
        <strong>已知色號限制辨識</strong>
        {activeEntries.length > 0 ? `，已啟用 ${activeEntries.length} 色` : ""}
      </summary>

      <div className="stacked-options">
        <label className="radio-card">
          <input
            type="radio"
            checked={paletteMode === "all-standard"}
            onChange={() => onPaletteModeChange("all-standard")}
          />
          <span><strong>所有 MARD 標準色</strong><small>用內建自動辨識候選色，不讀取底部色表。</small></span>
        </label>
        <label className="radio-card">
          <input
            type="radio"
            checked={paletteMode === "manual-known"}
            onChange={() => onPaletteModeChange("manual-known")}
          />
          <span><strong>手動匯入已知色號</strong><small>只用你貼上的色號辨識，適合原圖旁邊已有作者色號表時使用。</small></span>
        </label>
      </div>

      <label>
        貼上色號
        <textarea
          rows={4}
          value={bulkText}
          onChange={(event) => setBulkText(event.target.value)}
          placeholder={"B11 B13 B16 B17\n或 B11,B13,B16,B17"}
        />
      </label>
      <div className="toolbar compact-toolbar">
        <button type="button" onClick={importBulkCodes} disabled={!bulkText.trim()}>匯入色號</button>
        <button type="button" onClick={() => onChange(entries.map((entry) => ({ ...entry, enabled: true })))} disabled={!entries.length}>全選</button>
        <button type="button" onClick={() => onChange(entries.map((entry) => ({ ...entry, enabled: false })))} disabled={!entries.length}>全部停用</button>
        <button type="button" onClick={() => { onChange([]); setReport(null); }} disabled={!entries.length}>清除已知色號</button>
      </div>

      {report && (
        <div className="muted-note">
          {report.added.length > 0 && <div>已匯入：{report.added.join("、")}</div>}
          {report.duplicates.length > 0 && <div>已略過重複：{report.duplicates.join("、")}</div>}
          {report.invalid.length > 0 && <div>無效色號：{report.invalid.join("、")}</div>}
        </div>
      )}

      {entries.length > 0 && (
        <div className="legend-palette-list">
          {entries.map((entry, index) => {
            const code = entry.code.trim().toUpperCase();
            const official = mardPaletteByCode.get(code);
            return (
              <div className="legend-palette-row" key={entry.id}>
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  aria-label={`啟用色號 ${index + 1}`}
                  onChange={(event) => update(entry.id, { enabled: event.target.checked })}
                />
                <span className="swatch" style={{ background: official?.hex ?? entry.sampledHex }} />
                <input
                  list="mard-color-codes"
                  value={entry.code}
                  placeholder="例如 B13"
                  aria-label={`色號 ${index + 1}`}
                  onChange={(event) => update(entry.id, { code: event.target.value })}
                />
                <span className={official ? "legend-valid" : "legend-invalid"}>{official ? official.name : "無效"}</span>
                <button type="button" aria-label={`刪除色號 ${index + 1}`} onClick={() => onChange(entries.filter((item) => item.id !== entry.id))}>刪除</button>
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
          <label>搜尋色號<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="A1 / B13" /></label>
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
            const isRecognitionCandidate = recognitionCodeSet.has(color.code);
            return (
              <button
                type="button"
                key={color.code}
                className={added ? "active" : ""}
                onClick={() => addManualColor(color.code)}
                title={isRecognitionCandidate ? color.name : `${color.name}，可手動加入但不屬於自動標準候選色`}
              >
                <span className="swatch" style={{ background: color.hex }} />
                <span>{color.code}</span>
              </button>
            );
          })}
        </div>
      </div>

      {paletteMode === "manual-known" && activeEntries.length === 0 && (
        <p className="warning-note">請先匯入至少一個有效色號，系統才會使用已知色號限制辨識。</p>
      )}
    </details>
  );
}

function parseColorCodes(value: string): string[] {
  return value
    .split(/[\s,，;；、\t\r\n]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function importCodes(codes: string[], currentEntries: ChartLocalPaletteEntry[]) {
  const entries = [...currentEntries];
  const existing = new Set(entries.map((entry) => entry.code.trim().toUpperCase()).filter(Boolean));
  const seenInInput = new Set<string>();
  const report: ImportReport = { added: [], duplicates: [], invalid: [] };

  for (const rawCode of codes) {
    const code = rawCode.trim().toUpperCase();
    if (!code) continue;
    const color = mardPaletteByCode.get(code);
    if (!color) {
      if (!report.invalid.includes(code)) report.invalid.push(code);
      continue;
    }
    if (existing.has(code) || seenInInput.has(code)) {
      if (!report.duplicates.includes(code)) report.duplicates.push(code);
      entries.forEach((entry) => {
        if (entry.code.trim().toUpperCase() === code) entry.enabled = true;
      });
      continue;
    }
    seenInInput.add(code);
    existing.add(code);
    report.added.push(code);
    entries.push({
      id: crypto.randomUUID(),
      code: color.code,
      sampledHex: color.hex,
      officialHex: color.hex,
      source: "manual",
      confidence: 1,
      enabled: true
    });
  }

  return { entries, report };
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
