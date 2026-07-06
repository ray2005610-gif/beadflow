import { useState } from "react";
import { recognitionPalette } from "../data/recognitionPalette";
import type { BeadColor } from "../types/bead";
import type { PatternGrid } from "../types/pattern";
import type { PatternProject } from "../types/project";
import { defaultBackgroundRemovalOptions, imageToPattern, type BackgroundRemovalOptions } from "../utils/imageToPattern";
import { findClosestBeadColorWithDebug, rgbToHex } from "../utils/colorUtils";
import { calculateColorStats } from "../utils/patternStats";
import { BoardPresetSelector } from "./BoardPresetSelector";

export function PhotoToPatternPage({ onProjectReady }: { onProjectReady: (project: PatternProject) => void }) {
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [width, setWidth] = useState(52);
  const [height, setHeight] = useState(52);
  const [maxColors, setMaxColors] = useState(0);
  const [working, setWorking] = useState(false);
  const [backgroundOptions, setBackgroundOptions] = useState<BackgroundRemovalOptions>(defaultBackgroundRemovalOptions);

  const upload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const convert = async () => {
    if (!imageDataUrl) return;
    setWorking(true);
    try {
      const fullGrid = await imageToPattern(imageDataUrl, width, height, recognitionPalette, backgroundOptions);
      const grid = maxColors > 0 ? limitGridColors(fullGrid, maxColors) : fullGrid;
      const now = new Date().toISOString();
      onProjectReady({
        id: crypto.randomUUID(),
        name: `照片轉拼豆 ${new Date().toLocaleString("zh-TW")}`,
        sourceType: "photo_to_pattern",
        size: { width, height },
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
          <h2>照片轉拼豆</h2>
          <p>上傳 PNG、JPG 或 WebP，系統會轉成拼豆圖紙。第一版會排除特殊材質色，避免自動配色誤判。</p>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => upload(event.target.files?.[0] ?? null)} />
        </div>
        {imageDataUrl && <img className="photo-preview" src={imageDataUrl} alt="照片預覽" />}
      </section>
      <aside className="side-rail">
        <BoardPresetSelector width={width} height={height} onChange={(nextWidth, nextHeight) => { setWidth(nextWidth); setHeight(nextHeight); }} />
        <div className="panel">
          <h3>轉換設定</h3>
          <label>
            最多色數
            <input type="number" min={0} max={80} value={maxColors} onChange={(event) => setMaxColors(Math.max(0, Number(event.target.value)))} />
          </label>
          <p>0 代表不限制色數。限制色數可讓圖紙更容易備料，但顏色細節會減少。</p>
        </div>
        <div className="panel">
          <h3>背景處理</h3>
          <label>
            模式
            <select value={backgroundOptions.mode} onChange={(event) => setBackgroundOptions((value) => ({ ...value, mode: event.target.value as BackgroundRemovalOptions["mode"] }))}>
              <option value="auto">自動</option>
              <option value="transparentOnly">只處理透明背景</option>
              <option value="whiteBackground">白底背景</option>
              <option value="checkerboard">白底棋盤格背景</option>
              <option value="pickedColor">指定背景色</option>
              <option value="none">不移除背景</option>
            </select>
          </label>
          <div className="inline-fields">
            <label>
              透明門檻
              <input type="number" min={0} max={255} value={backgroundOptions.alphaThreshold} onChange={(event) => setBackgroundOptions((value) => ({ ...value, alphaThreshold: Number(event.target.value) }))} />
            </label>
            <label>
              白色門檻
              <input type="number" min={180} max={255} value={backgroundOptions.whiteThreshold} onChange={(event) => setBackgroundOptions((value) => ({ ...value, whiteThreshold: Number(event.target.value) }))} />
            </label>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={backgroundOptions.protectRealWhiteAndGray} onChange={(event) => setBackgroundOptions((value) => ({ ...value, protectRealWhiteAndGray: event.target.checked }))} />
            保護圖案中的白色與灰色，不當成背景移除
          </label>
          <label>
            指定背景色
            <input type="color" value={backgroundOptions.backgroundSampleColor ?? "#ffffff"} onChange={(event) => setBackgroundOptions((value) => ({ ...value, backgroundSampleColor: event.target.value, removeNearBackgroundColor: true, mode: "pickedColor" }))} />
          </label>
        </div>
        <button className="primary wide" onClick={convert} disabled={!imageDataUrl || working}>{working ? "轉換中..." : "轉成拼豆圖紙"}</button>
      </aside>
    </main>
  );
}

function limitGridColors(grid: PatternGrid, maxColors: number): PatternGrid {
  const allowedCodes = calculateColorStats(grid).sort((a, b) => b.total - a.total).slice(0, maxColors).map((stat) => stat.code);
  const allowedPalette = allowedCodes.map((code) => recognitionPalette.find((color) => color.code === code)).filter(Boolean) as BeadColor[];
  if (!allowedPalette.length) return grid;
  return grid.map((row) => row.map((cell) => {
    if (cell.empty || !cell.rawRgb) return cell;
    if (allowedCodes.includes(cell.colorCode)) return cell;
    const match = findClosestBeadColorWithDebug(cell.rawRgb, allowedPalette);
    return {
      ...cell,
      colorCode: match.color.code,
      colorName: match.color.name,
      hex: match.color.hex,
      symbol: match.color.symbol,
      rawHex: cell.rawHex ?? rgbToHex(cell.rawRgb),
      confidence: match.confidence,
      distance: match.distance,
      adjustedDistance: match.adjustedDistance,
      candidates: match.candidates,
      rawHue: match.rawHue,
      rawSaturation: match.rawSaturation
    };
  }));
}
