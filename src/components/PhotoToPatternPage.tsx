import { useState } from "react";
import { recognitionPalette } from "../data/recognitionPalette";
import type { PatternProject } from "../types/project";
import {
  defaultBackgroundRemovalOptions,
  imageToPattern,
  type BackgroundRemovalOptions,
  type PhotoColorMode
} from "../utils/imageToPattern";
import { BoardPresetSelector } from "./BoardPresetSelector";

export function PhotoToPatternPage({ onProjectReady }: { onProjectReady: (project: PatternProject) => void }) {
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [width, setWidth] = useState(52);
  const [height, setHeight] = useState(52);
  const [maxColors, setMaxColors] = useState(48);
  const [colorMode, setColorMode] = useState<PhotoColorMode>("natural");
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
      const grid = await imageToPattern(imageDataUrl, width, height, recognitionPalette, backgroundOptions, {
        colorMode,
        maxColors
      });
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
          <p>上傳照片或插畫，系統會用感知色差與穩定取樣轉成拼豆圖紙。</p>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => upload(event.target.files?.[0] ?? null)} />
        </div>
        {imageDataUrl && <img className="photo-preview" src={imageDataUrl} alt="照片預覽" />}
      </section>
      <aside className="side-rail">
        <BoardPresetSelector width={width} height={height} onChange={(nextWidth, nextHeight) => { setWidth(nextWidth); setHeight(nextHeight); }} />
        <div className="panel">
          <h3>配色設定</h3>
          <label>
            配色模式
            <select value={colorMode} onChange={(event) => setColorMode(event.target.value as PhotoColorMode)}>
              <option value="natural">自然接近模式</option>
              <option value="vivid">鮮豔模式</option>
              <option value="soft">柔和模式</option>
              <option value="contrast">高對比模式</option>
            </select>
          </label>
          <label>
            最大色數
            <select value={maxColors} onChange={(event) => setMaxColors(Number(event.target.value))}>
              <option value={24}>24 色</option>
              <option value={48}>48 色</option>
              <option value={96}>96 色</option>
              <option value={0}>不限制</option>
            </select>
          </label>
        </div>
        <div className="panel">
          <h3>背景處理</h3>
          <label>
            模式
            <select value={backgroundOptions.mode} onChange={(event) => setBackgroundOptions((value) => ({ ...value, mode: event.target.value as BackgroundRemovalOptions["mode"] }))}>
              <option value="auto">移除透明 / 邊界背景</option>
              <option value="transparentOnly">只移除透明背景</option>
              <option value="none">保留背景</option>
              <option value="pickedColor">指定背景色</option>
            </select>
          </label>
          <div className="inline-fields">
            <label>
              透明門檻
              <input type="number" min={0} max={255} value={backgroundOptions.alphaThreshold} onChange={(event) => setBackgroundOptions((value) => ({ ...value, alphaThreshold: Number(event.target.value) }))} />
            </label>
            <label>
              背景容差
              <input type="number" min={5} max={80} value={backgroundOptions.backgroundTolerance} onChange={(event) => setBackgroundOptions((value) => ({ ...value, backgroundTolerance: Number(event.target.value) }))} />
            </label>
          </div>
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
