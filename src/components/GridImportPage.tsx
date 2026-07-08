import { useState } from "react";
import type { ChartLocalPaletteEntry, GridCalibration } from "../types/calibration";
import type { PatternProject } from "../types/project";
import { recognitionPalette } from "../data/recognitionPalette";
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

  const upload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCalibration(null);
      setChartLocalPalette([]);
      setImageDataUrl(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const recognize = async () => {
    if (!imageDataUrl || !calibration) return;
    setWorking(true);
    try {
      const grid = await recognizeGridPatternFromImage(
        imageDataUrl,
        calibration,
        recognitionPalette,
        defaultRecognitionOptions,
        chartLocalPalette
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
        tags: []
      });
    } finally {
      setWorking(false);
    }
  };

  const detectLegend = async () => {
    if (!imageDataUrl || !calibration) return;
    setDetectingLegend(true);
    try {
      setChartLocalPalette(await extractLegendPalette(imageDataUrl, calibration));
    } finally {
      setDetectingLegend(false);
    }
  };

  return (
    <main className="workspace two-col">
      <section className="main-stage">
        <div className="panel">
          <h2>辨識格線圖紙</h2>
          <p>請上傳有格線的拼豆圖紙，可以是截圖或下載圖片。先框選一個 3×3 格子範圍，再用右側欄位微調格線與裁切範圍。</p>
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
            onDetect={detectLegend}
            onChange={setChartLocalPalette}
          />
        )}
        {working && <div className="panel">辨識中...</div>}
      </aside>
    </main>
  );
}
