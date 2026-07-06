import { useEffect, useMemo, useRef, useState } from "react";
import { recognitionPalette } from "../data/recognitionPalette";
import type { PatternGrid } from "../types/pattern";
import type { PatternProject } from "../types/project";
import {
  defaultBackgroundRemovalOptions,
  imageToPattern,
  type BackgroundRemovalOptions,
  type PhotoFitMode,
  type PhotoPatternMeta,
  type PhotoPatternResult
} from "../utils/imageToPattern";
import { BoardPresetSelector } from "./BoardPresetSelector";

type PreviewMode = "compare" | "original" | "bead";

const fitModeLabels: Record<PhotoFitMode, string> = {
  contain: "保持原比例",
  stretch: "填滿底板",
  crop: "等比例裁切",
  manual: "手動調整"
};

export function PhotoToPatternPage({ onProjectReady }: { onProjectReady: (project: PatternProject) => void }) {
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [width, setWidth] = useState(52);
  const [height, setHeight] = useState(52);
  const [fitMode, setFitMode] = useState<PhotoFitMode>("contain");
  const [manualScale, setManualScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("compare");
  const [working, setWorking] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<PhotoPatternResult | null>(null);
  const [backgroundOptions, setBackgroundOptions] = useState<BackgroundRemovalOptions>(defaultBackgroundRemovalOptions);

  const photoOptions = useMemo(() => ({
    colorMode: "natural" as const,
    maxColors: 0,
    fitMode,
    manualScale,
    offsetX,
    offsetY
  }), [fitMode, manualScale, offsetX, offsetY]);

  const upload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!imageDataUrl) {
      setPreviewResult(null);
      return;
    }
    let cancelled = false;
    setPreviewing(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await imageToPattern(imageDataUrl, width, height, recognitionPalette, backgroundOptions, photoOptions);
        if (!cancelled) setPreviewResult(result);
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [backgroundOptions, height, imageDataUrl, photoOptions, width]);

  const convert = async () => {
    if (!imageDataUrl) return;
    setWorking(true);
    try {
      const result = previewResult ?? await imageToPattern(imageDataUrl, width, height, recognitionPalette, backgroundOptions, photoOptions);
      const now = new Date().toISOString();
      onProjectReady({
        id: crypto.randomUUID(),
        name: `照片轉拼豆 ${new Date().toLocaleString("zh-TW")}`,
        sourceType: "photo_to_pattern",
        size: { width, height },
        grid: result.grid,
        originalImageDataUrl: imageDataUrl,
        createdAt: now,
        updatedAt: now,
        status: "draft",
        tags: [fitModeLabels[fitMode], `${result.meta.patternWidth}x${result.meta.patternHeight}`]
      });
    } finally {
      setWorking(false);
    }
  };

  const meta = previewResult?.meta;

  return (
    <main className="workspace photo-workspace">
      <section className="main-stage">
        <div className="panel">
          <h2>照片轉拼豆</h2>
          <p>上傳照片或插畫後，BeadFlow 會保留圖案比例並用自然感知色差配對 MARD 色號。</p>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => upload(event.target.files?.[0] ?? null)} />
        </div>
        {imageDataUrl && (
          <div className="panel preview-panel">
            <div className="preview-toolbar">
              <strong>原圖 / 拼豆圖對照</strong>
              <select value={previewMode} onChange={(event) => setPreviewMode(event.target.value as PreviewMode)}>
                <option value="compare">並排比較</option>
                <option value="original">只看原圖</option>
                <option value="bead">只看拼豆圖</option>
              </select>
            </div>
            <div className={`photo-compare ${previewMode}`}>
              {previewMode !== "bead" && <figure><img className="photo-preview" src={imageDataUrl} alt="原圖預覽" /><figcaption>原圖</figcaption></figure>}
              {previewMode !== "original" && <figure><PatternPreviewCanvas grid={previewResult?.grid ?? null} /><figcaption>{previewing ? "拼豆預覽更新中" : "拼豆預覽"}</figcaption></figure>}
            </div>
          </div>
        )}
      </section>
      <aside className="side-rail">
        <BoardPresetSelector width={width} height={height} onChange={(nextWidth, nextHeight) => { setWidth(nextWidth); setHeight(nextHeight); }} />
        <div className="panel">
          <h3>圖片適配</h3>
          <label>
            適配模式
            <select value={fitMode} onChange={(event) => setFitMode(event.target.value as PhotoFitMode)}>
              <option value="contain">保持原比例，不裁切、不變形</option>
              <option value="stretch">填滿底板，可能會變形</option>
              <option value="crop">等比例裁切，填滿底板</option>
              <option value="manual">手動調整縮放與位置</option>
            </select>
          </label>
          {fitMode === "manual" && (
            <div className="grid-fields">
              <label>縮放比例<input type="number" min={0.2} max={3} step={0.05} value={manualScale} onChange={(event) => setManualScale(Number(event.target.value))} /></label>
              <label>X 偏移<input type="number" step={1} value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} /></label>
              <label>Y 偏移<input type="number" step={1} value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} /></label>
            </div>
          )}
          <PhotoMeta meta={meta} width={width} height={height} />
        </div>
        <div className="panel">
          <h3>背景處理</h3>
          <label>
            背景模式
            <select value={backgroundOptions.mode} onChange={(event) => setBackgroundOptions((value) => ({ ...value, mode: event.target.value as BackgroundRemovalOptions["mode"] }))}>
              <option value="auto">移除透明 / 邊界背景</option>
              <option value="transparentOnly">只移除透明背景</option>
              <option value="none">保留背景</option>
              <option value="pickedColor">移除指定背景色</option>
            </select>
          </label>
          <label>
            指定背景色
            <input type="color" value={backgroundOptions.backgroundSampleColor ?? "#ffffff"} onChange={(event) => setBackgroundOptions((value) => ({ ...value, backgroundSampleColor: event.target.value, removeNearBackgroundColor: true, mode: "pickedColor" }))} />
          </label>
        </div>
        <button className="primary wide" onClick={convert} disabled={!imageDataUrl || working || previewing}>{working ? "轉換中..." : "產生可編輯圖紙"}</button>
      </aside>
    </main>
  );
}

function PhotoMeta({ meta, width, height }: { meta?: PhotoPatternMeta; width: number; height: number }) {
  const boardCells = width * height;
  return (
    <dl className="meta-grid">
      <div><dt>底板尺寸</dt><dd>{width} × {height}</dd></div>
      <div><dt>實際圖案尺寸</dt><dd>{meta ? `${meta.patternWidth} × ${meta.patternHeight}` : "尚未產生"}</dd></div>
      <div><dt>留白格數</dt><dd>{meta ? meta.blankCells.toLocaleString("zh-TW") : boardCells.toLocaleString("zh-TW")}</dd></div>
      <div><dt>實際豆數</dt><dd>{meta ? meta.beadCells.toLocaleString("zh-TW") : "0"}</dd></div>
    </dl>
  );
}

function PatternPreviewCanvas({ grid }: { grid: PatternGrid | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = grid?.[0]?.length ?? 52;
    const height = grid?.length ?? 52;
    const cell = Math.max(4, Math.floor(Math.min(520 / width, 520 / height)));
    canvas.width = width * cell;
    canvas.height = height * cell;
    ctx.fillStyle = "#fffaf1";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!grid) return;
    for (const row of grid) {
      for (const item of row) {
        const x = item.col * cell;
        const y = item.row * cell;
        if (item.empty || !item.colorCode) {
          ctx.fillStyle = (item.row + item.col) % 2 === 0 ? "#fffdf8" : "#f3eadf";
          ctx.fillRect(x, y, cell, cell);
          continue;
        }
        ctx.fillStyle = item.hex;
        ctx.fillRect(x, y, cell, cell);
      }
    }
    ctx.strokeStyle = "rgba(92, 70, 50, 0.18)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 5) {
      ctx.beginPath();
      ctx.moveTo(x * cell, 0);
      ctx.lineTo(x * cell, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 5) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell);
      ctx.lineTo(canvas.width, y * cell);
      ctx.stroke();
    }
  }, [grid]);
  return <canvas className="bead-preview-canvas" ref={canvasRef} aria-label="拼豆預覽" />;
}
