import { useState } from "react";
import type { ChartLocalPaletteEntry, GridCalibration, GridRecognitionPaletteMode } from "../types/calibration";
import type { PatternProject } from "../types/project";
import { recognitionPalette } from "../data/recognitionPalette";
import { mardPaletteByCode } from "../data/mardPalette";
import { extractLegendPalette, recognizeGridPatternFromImage, defaultRecognitionOptions } from "../utils/gridRecognition";
import { GridCalibrationCanvas } from "./GridCalibrationCanvas";
import { CalibrationPanel } from "./CalibrationPanel";
import { LegendPalettePanel } from "./LegendPalettePanel";

export function GridImportPage({ onProjectReady }: { onProjectReady: (project: PatternProject) => void }) {
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [calibration, setCalibration] = useState<GridCalibration | null>(null);
  const [working, setWorking] = useState(false);
  const [detectingLegend, setDetectingLegend] = useState(false);
  const [chartLocalPalette, setChartLocalPalette] = useState<ChartLocalPaletteEntry[]>([]);
  const [paletteMode, setPaletteMode] = useState<GridRecognitionPaletteMode>("all");
  const [recognitionWarning, setRecognitionWarning] = useState("");

  const upload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCalibration(null);
      setChartLocalPalette([]);
      setPaletteMode("all");
      setRecognitionWarning("");
      setImageDataUrl(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const recognize = async () => {
    if (!imageDataUrl || !calibration) return;
    const activeKnownColors = getActiveKnownColorEntries(chartLocalPalette, paletteMode);
    if (paletteMode !== "all" && activeKnownColors.length === 0) {
      setRecognitionWarning("尚未選擇任何有效色號。請手動新增色號，或切回所有 MARD 標準色辨識。");
      return;
    }
    setRecognitionWarning(activeKnownColors.length === 1 ? "目前只啟用 1 個已知色號，所有非透明格都會使用同一個色號。" : "");
    setWorking(true);
    try {
      const grid = await recognizeGridPatternFromImage(
        imageDataUrl,
        calibration,
        recognitionPalette,
        defaultRecognitionOptions,
        activeKnownColors
      );
      const now = new Date().toISOString();
      onProjectReady({
        id: crypto.randomUUID(),
        name: `格線辨識圖紙 ${new Date().toLocaleString("zh-TW")}`,
        sourceType: "grid_recognition",
        size: { width: grid[0]?.length ?? 0, height: grid.length },
        grid,
        originalImageDataUrl: imageDataUrl,
        createdAt: now,
        updatedAt: now,
        status: "draft",
        tags: [paletteMode === "all" ? "所有標準色" : `已知色號 ${activeKnownColors.length} 色`]
      });
    } finally {
      setWorking(false);
    }
  };

  const detectLegend = async () => {
    if (!imageDataUrl || !calibration) return;
    setDetectingLegend(true);
    try {
      const entries = await extractLegendPalette(imageDataUrl, calibration);
      setChartLocalPalette(entries);
      if (entries.length) setPaletteMode("legend");
    } finally {
      setDetectingLegend(false);
    }
  };

  return (
    <main className="workspace two-col">
      <section className="main-stage">
        <div className="panel">
          <h2>辨識格線圖紙</h2>
          <p>請上傳有格線的拼豆圖紙，先框選 3×3 校正區域，再選擇辨識色號範圍。</p>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => upload(event.target.files?.[0] ?? null)} />
        </div>
        {imageDataUrl && <GridCalibrationCanvas imageDataUrl={imageDataUrl} calibration={calibration} onCalibrationChange={setCalibration} />}
      </section>
      <aside className="side-rail">
        <CalibrationPanel calibration={calibration} onChange={setCalibration} onRecognize={recognize} />
        {calibration && (
          <LegendPalettePanel
            entries={chartLocalPalette}
            detecting={detectingLegend}
            paletteMode={paletteMode}
            onPaletteModeChange={setPaletteMode}
            onDetect={detectLegend}
            onChange={setChartLocalPalette}
          />
        )}
        {recognitionWarning && <div className="panel warning-note">{recognitionWarning}</div>}
        {working && <div className="panel">辨識中...</div>}
      </aside>
    </main>
  );
}

function getActiveKnownColorEntries(entries: ChartLocalPaletteEntry[], mode: GridRecognitionPaletteMode): ChartLocalPaletteEntry[] {
  if (mode === "all") return [];
  const unique = new Map<string, ChartLocalPaletteEntry>();
  entries.filter((entry) => {
    if (!entry.enabled) return false;
    const code = entry.code.trim().toUpperCase();
    if (!code || code === "TRANSPARENT" || code === "EMPTY" || !mardPaletteByCode.has(code)) return false;
    return mode === "custom" || entry.source === "legend";
  }).forEach((entry) => {
    const code = entry.code.trim().toUpperCase();
    if (!unique.has(code)) unique.set(code, entry);
  });
  return Array.from(unique.values());
}
