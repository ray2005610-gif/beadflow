import { useEffect, useRef, useState } from "react";
import type { ChartLocalPaletteEntry, GridCalibration, GridRecognitionPaletteMode } from "../types/calibration";
import type { PatternProject } from "../types/project";
import { recognitionPalette } from "../data/recognitionPalette";
import { defaultRecognitionOptions } from "../utils/gridRecognition";
import { recognizeGridPatternFromImage } from "../utils/gridRecognitionClient";
import type { LegendEntry } from "../types/legend";
import { LegendImportPanel } from "./LegendImportPanel";
import { beginRecognitionProfile, markRecognitionCommit, recordRecognitionStages } from "../utils/recognitionProfile";
import { GridCalibrationCanvas } from "./GridCalibrationCanvas";
import { CalibrationPanel } from "./CalibrationPanel";
import { LegendPalettePanel } from "./LegendPalettePanel";

export function GridImportPage({ onProjectReady }: { onProjectReady: (project: PatternProject) => void }) {
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [calibration, setCalibration] = useState<GridCalibration | null>(null);
  const [working, setWorking] = useState(false);
  const [manualKnownColors, setManualKnownColors] = useState<ChartLocalPaletteEntry[]>([]);
  const [paletteMode, setPaletteMode] = useState<GridRecognitionPaletteMode>("all-standard");
  const [recognitionWarning, setRecognitionWarning] = useState("");
  const [legend, setLegend] = useState<LegendEntry[]>([]);
  const [legendBusy, setLegendBusy] = useState(false);
  const running = useRef(false);
  const abortController = useRef<AbortController>();
  useEffect(()=>()=>abortController.current?.abort(),[]);

  const upload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCalibration(null);
      setManualKnownColors([]);
      setLegend([]);
      recordRecognitionStages({ legendProcessing: 0 });
      setPaletteMode("all-standard");
      setRecognitionWarning("");
      setImageDataUrl(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const recognize = async () => {
    if (!imageDataUrl || !calibration || running.current || legendBusy) return;
    const activeKnownColors = getActiveKnownColorEntries(manualKnownColors, paletteMode);
    if (paletteMode === "manual-known" && activeKnownColors.length === 0) {
      setRecognitionWarning("請先匯入至少一個有效色號，才能使用已知色號限制辨識。");
      return;
    }

    setRecognitionWarning(activeKnownColors.length === 1 ? "目前只使用 1 個已知色號，辨識結果會全部接近這個色號。" : "");
    setWorking(true);
    running.current = true;
    beginRecognitionProfile();
    abortController.current = new AbortController();
    try {
      const grid = await recognizeGridPatternFromImage(
        imageDataUrl,
        calibration,
        recognitionPalette,
        defaultRecognitionOptions,
        activeKnownColors,
        legend,
        abortController.current.signal
      );
      const now = new Date().toISOString();
      markRecognitionCommit();
      onProjectReady({
        id: crypto.randomUUID(),
        name: `格線辨識圖紙 ${new Date().toLocaleString("zh-TW")}`,
        sourceType: "grid_recognition",
        size: { width: grid[0]?.length ?? 0, height: grid.length },
        grid,
        legend,
        originalImageDataUrl: imageDataUrl,
        createdAt: now,
        updatedAt: now,
        status: "draft",
        tags: [paletteMode === "all-standard" ? "所有標準色" : `已知色號 ${activeKnownColors.length} 色`]
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setRecognitionWarning(error instanceof Error ? error.message : "辨識失敗，請重新嘗試");
    } finally {
      running.current = false;
      setWorking(false);
    }
  };

  return (
    <main className="workspace two-col">
      <section className="main-stage">
        <div className="panel">
          <h2>辨識格線圖紙</h2>
          <p>請上傳有格線的拼豆圖紙，框選 3×3 區域後再微調辨識範圍。</p>
          <input type="file" disabled={working || legendBusy} accept="image/png,image/jpeg,image/webp" onChange={(event) => upload(event.target.files?.[0] ?? null)} />
        </div>
        {imageDataUrl && <GridCalibrationCanvas imageDataUrl={imageDataUrl} calibration={calibration} onCalibrationChange={setCalibration} />}
      </section>
      <aside className="side-rail">
        <CalibrationPanel calibration={calibration} onChange={setCalibration} onRecognize={recognize} working={working || legendBusy} />
        {calibration && <LegendImportPanel imageUrl={imageDataUrl} calibration={calibration} entries={legend} onChange={setLegend} onBusyChange={setLegendBusy} />}
        {calibration && (
          <LegendPalettePanel
            entries={manualKnownColors}
            paletteMode={paletteMode}
            onPaletteModeChange={setPaletteMode}
            onChange={setManualKnownColors}
          />
        )}
        {recognitionWarning && <div className="panel warning-note">{recognitionWarning}</div>}
        {working && <div className="panel">辨識中...</div>}
      </aside>
    </main>
  );
}

function getActiveKnownColorEntries(entries: ChartLocalPaletteEntry[], mode: GridRecognitionPaletteMode): ChartLocalPaletteEntry[] {
  if (mode === "all-standard") return [];
  const unique = new Map<string, ChartLocalPaletteEntry>();
  for (const entry of entries) {
    if (!entry.enabled || entry.source !== "manual") continue;
    const code = entry.code.trim().toUpperCase();
    if (!code || !recognitionPalette.some(color => color.code === code)) continue;
    if (!unique.has(code)) unique.set(code, entry);
  }
  return Array.from(unique.values());
}
