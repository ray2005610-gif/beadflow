import { useState } from "react";
import type { GridCalibration } from "../types/calibration";
import type { PatternProject } from "../types/project";
import { recognitionPalette } from "../data/recognitionPalette";
import { recognizeGridPatternFromImage, defaultRecognitionOptions } from "../utils/gridRecognition";
import { GridCalibrationCanvas } from "./GridCalibrationCanvas";
import { CalibrationPanel } from "./CalibrationPanel";

export function GridImportPage({ onProjectReady }: { onProjectReady: (project: PatternProject) => void }) {
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [calibration, setCalibration] = useState<GridCalibration | null>(null);
  const [working, setWorking] = useState(false);

  const upload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const recognize = async () => {
    if (!imageDataUrl || !calibration) return;
    setWorking(true);
    try {
      const grid = await recognizeGridPatternFromImage(imageDataUrl, calibration, recognitionPalette, defaultRecognitionOptions);
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

  return (
    <main className="workspace two-col">
      <section className="main-stage">
        <div className="panel">
          <h2>格線圖紙辨識</h2>
          <p>請上傳有格線的拼豆圖紙，可以是截圖或下載圖片。框選 3×3 格子後，可用辨識範圍排除色號表、邊框或浮水印。</p>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => upload(e.target.files?.[0] ?? null)} />
        </div>
        {imageDataUrl && <GridCalibrationCanvas imageDataUrl={imageDataUrl} calibration={calibration} onCalibrationChange={setCalibration} />}
      </section>
      <aside className="side-rail">
        <CalibrationPanel calibration={calibration} onChange={setCalibration} onRecognize={recognize} />
        {working && <div className="panel">辨識中...</div>}
      </aside>
    </main>
  );
}
