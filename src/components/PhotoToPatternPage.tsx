import { useEffect, useMemo, useRef, useState } from "react";
import { recognitionPalette } from "../data/recognitionPalette";
import type { PointerEvent } from "react";
import type { PatternGrid } from "../types/pattern";
import type { PatternProject } from "../types/project";
import { isEmptyOrTransparentCell } from "../data/emptyColor";
import {
  defaultBackgroundRemovalOptions,
  calculatePhotoPlacement,
  imageToPattern,
  loadImage,
  type BackgroundRemovalOptions,
  type PhotoFitMode,
  type PhotoQualityMode,
  type PhotoPatternMeta,
  type PhotoPatternResult,
  type SubjectMask
} from "../utils/imageToPattern";
import { reducePatternPalette, type PhotoColorLimit } from "../utils/photoPaletteReduction";
import { BoardPresetSelector } from "./BoardPresetSelector";

type PreviewMode = "compare" | "original" | "bead";
type MaskTool = "rectangle" | "brush-add" | "brush-remove" | "grid";
type MaskOperation = "replace" | "add" | "remove";

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
  const [colorLimit, setColorLimit] = useState<PhotoColorLimit>(0);
  const [qualityMode, setQualityMode] = useState<PhotoQualityMode>("standard");
  const [maskGrid, setMaskGrid] = useState<boolean[] | null>(null);
  const [maskTool, setMaskTool] = useState<MaskTool>("rectangle");
  const [maskOperation, setMaskOperation] = useState<MaskOperation>("replace");
  const [brushSize, setBrushSize] = useState(2);
  const [maskHistory, setMaskHistory] = useState<boolean[][]>([]);
  const [maskFuture, setMaskFuture] = useState<boolean[][]>([]);

  const photoOptions = useMemo(() => ({
    colorMode: "natural" as const,
    maxColors: 0,
    fitMode,
    manualScale,
    offsetX,
    offsetY,
    imageKind: "auto" as const,
    qualityMode,
    subjectMask: maskGrid ? {
      imageWidth: width,
      imageHeight: height,
      gridWidth: width,
      gridHeight: height,
      gridMask: maskGrid
    } satisfies SubjectMask : null
  }), [fitMode, manualScale, maskGrid, offsetX, offsetY, qualityMode, width, height]);

  const upload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMaskGrid(null);
      setMaskHistory([]);
      setMaskFuture([]);
      setImageDataUrl(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    setMaskGrid(null);
    setMaskHistory([]);
    setMaskFuture([]);
  }, [width, height]);

  const commitMask = (nextMask: boolean[] | null) => {
    setMaskHistory((history) => [...history.slice(-19), maskGrid ? [...maskGrid] : createMask(width, height, true)]);
    setMaskFuture([]);
    setMaskGrid(nextMask ? [...nextMask] : null);
  };

  const undoMask = () => {
    setMaskHistory((history) => {
      const previous = history[history.length - 1];
      if (!previous) return history;
      setMaskFuture((future) => [maskGrid ? [...maskGrid] : createMask(width, height, true), ...future.slice(0, 19)]);
      setMaskGrid([...previous]);
      return history.slice(0, -1);
    });
  };

  const redoMask = () => {
    setMaskFuture((future) => {
      const next = future[0];
      if (!next) return future;
      setMaskHistory((history) => [...history.slice(-19), maskGrid ? [...maskGrid] : createMask(width, height, true)]);
      setMaskGrid([...next]);
      return future.slice(1);
    });
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
      const result = displayResult ?? previewResult ?? await imageToPattern(imageDataUrl, width, height, recognitionPalette, backgroundOptions, photoOptions);
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

  const displayResult = useMemo<PhotoPatternResult | null>(() => {
    if (!previewResult || colorLimit === 0) return previewResult;
    return {
      ...previewResult,
      grid: reducePatternPalette(previewResult.grid, recognitionPalette, colorLimit)
    };
  }, [colorLimit, previewResult]);

  const meta = displayResult?.meta;

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
              {previewMode !== "original" && <figure><PatternPreviewCanvas grid={displayResult?.grid ?? null} /><figcaption>{previewing ? "拼豆預覽更新中" : "拼豆預覽"}</figcaption></figure>}
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
        <div className="panel">
          <h3>辨識品質</h3>
          <div className="stacked-options">
            <label className="radio-card">
              <input type="radio" checked={qualityMode === "standard"} onChange={() => setQualityMode("standard")} />
              <span><strong>標準</strong><small>保留目前既有照片轉拼豆流程。</small></span>
            </label>
            <label className="radio-card">
              <input type="radio" checked={qualityMode === "detail"} onChange={() => setQualityMode("detail")} />
              <span><strong>高精度細節</strong><small>使用多點取樣、邊緣與亮暗保護，較慢但保留更多細節。</small></span>
            </label>
          </div>
          {qualityMode === "detail" && width * height <= 900 && (
            <p className="muted-note">目前尺寸較小，部分細節仍可能被簡化。較大的圖紙尺寸能保留更多細節。</p>
          )}
        </div>
        {imageDataUrl && (
          <div className="panel subject-mask-panel">
            <h3>主體選取</h3>
            <p className="muted-note">未建立選取時預設保留整張圖；建立 Mask 後，框外會輸出透明格，不計入統計與成本。</p>
            <div className="toolbar compact-toolbar">
              <button type="button" className={maskTool === "rectangle" ? "active" : ""} onClick={() => setMaskTool("rectangle")}>矩形選取</button>
              <button type="button" className={maskTool === "brush-add" ? "active" : ""} onClick={() => setMaskTool("brush-add")}>選取畫筆</button>
              <button type="button" className={maskTool === "brush-remove" ? "active" : ""} onClick={() => setMaskTool("brush-remove")}>移除畫筆</button>
              <button type="button" className={maskTool === "grid" ? "active" : ""} onClick={() => setMaskTool("grid")}>逐格修正</button>
            </div>
            {maskTool === "rectangle" && (
              <div className="segmented-control">
                <button type="button" className={maskOperation === "replace" ? "active" : ""} onClick={() => setMaskOperation("replace")}>取代</button>
                <button type="button" className={maskOperation === "add" ? "active" : ""} onClick={() => setMaskOperation("add")}>新增</button>
                <button type="button" className={maskOperation === "remove" ? "active" : ""} onClick={() => setMaskOperation("remove")}>移除</button>
              </div>
            )}
            {(maskTool === "brush-add" || maskTool === "brush-remove") && (
              <label>畫筆尺寸
                <input type="range" min={1} max={8} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
              </label>
            )}
            <SubjectMaskCanvas
              imageDataUrl={imageDataUrl}
              width={width}
              height={height}
              fitMode={fitMode}
              manualScale={manualScale}
              offsetX={offsetX}
              offsetY={offsetY}
              maskGrid={maskGrid}
              maskTool={maskTool}
              maskOperation={maskOperation}
              brushSize={brushSize}
              onCommit={commitMask}
            />
            <div className="toolbar compact-toolbar">
              <button type="button" onClick={() => commitMask(createMask(width, height, true))}>全選</button>
              <button type="button" onClick={() => { if (window.confirm("確定要清除主體選取嗎？")) commitMask(createMask(width, height, false)); }}>清除選取</button>
              <button type="button" onClick={() => commitMask(invertMask(maskGrid ?? createMask(width, height, true)))}>反轉選取</button>
              <button type="button" onClick={undoMask} disabled={!maskHistory.length}>復原</button>
              <button type="button" onClick={redoMask} disabled={!maskFuture.length}>重做</button>
            </div>
            <p className="muted-note">目前保留 {countSelected(maskGrid, width, height).toLocaleString("zh-TW")} 格，透明 {((width * height) - countSelected(maskGrid, width, height)).toLocaleString("zh-TW")} 格。</p>
          </div>
        )}
        <div className="panel">
          <h3>色彩數量</h3>
          <label>
            色彩數量
            <select value={colorLimit} onChange={(event) => setColorLimit(Number(event.target.value) as PhotoColorLimit)}>
              <option value={0}>不限制</option>
              <option value={24}>24 色</option>
              <option value={48}>48 色</option>
              <option value={72}>72 色</option>
              <option value={96}>96 色</option>
            </select>
          </label>
          <p className="muted-note">只影響照片轉拼豆，會從 MARD A～M 標準色中挑選最適合目前圖片的顏色。不限制時保留原始轉換結果。</p>
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

function SubjectMaskCanvas({
  imageDataUrl,
  width,
  height,
  fitMode,
  manualScale,
  offsetX,
  offsetY,
  maskGrid,
  maskTool,
  maskOperation,
  brushSize,
  onCommit
}: {
  imageDataUrl: string;
  width: number;
  height: number;
  fitMode: PhotoFitMode;
  manualScale: number;
  offsetX: number;
  offsetY: number;
  maskGrid: boolean[] | null;
  maskTool: MaskTool;
  maskOperation: MaskOperation;
  brushSize: number;
  onCommit: (mask: boolean[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const draftMaskRef = useRef<boolean[] | null>(null);
  const dragStartRef = useRef<{ row: number; col: number } | null>(null);
  const paintValueRef = useRef(true);
  const [liveRect, setLiveRect] = useState<{ startRow: number; endRow: number; startCol: number; endCol: number } | null>(null);
  const [paintVersion, setPaintVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadImage(imageDataUrl).then((image) => {
      if (cancelled) return;
      imageRef.current = image;
      draw();
    });
    return () => {
      cancelled = true;
    };
  }, [imageDataUrl]);

  useEffect(() => {
    draw();
  }, [width, height, fitMode, manualScale, offsetX, offsetY, maskGrid, liveRect, paintVersion]);

  const currentMask = () => draftMaskRef.current ?? maskGrid ?? createMask(width, height, true);

  const draw = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const maxWidth = 520;
    const cell = Math.max(5, Math.floor(Math.min(maxWidth / width, maxWidth / height)));
    const ratio = window.devicePixelRatio || 1;
    canvas.style.width = `${width * cell}px`;
    canvas.style.height = `${height * cell}px`;
    canvas.width = Math.floor(width * cell * ratio);
    canvas.height = Math.floor(height * cell * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawChecker(ctx, width * cell, height * cell, cell);
    const placement = calculatePhotoPlacement(image.naturalWidth, image.naturalHeight, width, height, { fitMode, manualScale, offsetX, offsetY });
    ctx.drawImage(
      image,
      placement.cropX,
      placement.cropY,
      placement.cropWidth,
      placement.cropHeight,
      placement.offsetX * cell,
      placement.offsetY * cell,
      placement.patternWidth * cell,
      placement.patternHeight * cell
    );
    const mask = currentMask();
    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < width; col += 1) {
        const selected = mask[row * width + col];
        if (!selected) {
          ctx.fillStyle = "rgba(67, 42, 31, 0.48)";
          ctx.fillRect(col * cell, row * cell, cell, cell);
        }
      }
    }
    if (liveRect) {
      ctx.fillStyle = maskOperation === "remove" ? "rgba(190, 80, 68, 0.22)" : "rgba(201, 162, 126, 0.24)";
      ctx.strokeStyle = maskOperation === "remove" ? "#A8473F" : "#8B5E3C";
      ctx.lineWidth = 2;
      ctx.fillRect(liveRect.startCol * cell, liveRect.startRow * cell, (liveRect.endCol - liveRect.startCol + 1) * cell, (liveRect.endRow - liveRect.startRow + 1) * cell);
      ctx.strokeRect(liveRect.startCol * cell, liveRect.startRow * cell, (liveRect.endCol - liveRect.startCol + 1) * cell, (liveRect.endRow - liveRect.startRow + 1) * cell);
    }
    ctx.strokeStyle = "rgba(92, 70, 50, 0.26)";
    for (let col = 0; col <= width; col += 1) {
      ctx.lineWidth = col % 5 === 0 ? 1.4 : 0.6;
      ctx.beginPath();
      ctx.moveTo(col * cell, 0);
      ctx.lineTo(col * cell, height * cell);
      ctx.stroke();
    }
    for (let row = 0; row <= height; row += 1) {
      ctx.lineWidth = row % 5 === 0 ? 1.4 : 0.6;
      ctx.beginPath();
      ctx.moveTo(0, row * cell);
      ctx.lineTo(width * cell, row * cell);
      ctx.stroke();
    }
  };

  const cellFromEvent = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const col = Math.max(0, Math.min(width - 1, Math.floor(((event.clientX - rect.left) / rect.width) * width)));
    const row = Math.max(0, Math.min(height - 1, Math.floor(((event.clientY - rect.top) / rect.height) * height)));
    return { row, col };
  };

  const paintAt = (row: number, col: number) => {
    const draft = draftMaskRef.current;
    if (!draft) return;
    for (let dr = -brushSize; dr <= brushSize; dr += 1) {
      for (let dc = -brushSize; dc <= brushSize; dc += 1) {
        if (Math.hypot(dr, dc) > brushSize) continue;
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (nextRow < 0 || nextRow >= height || nextCol < 0 || nextCol >= width) continue;
        draft[nextRow * width + nextCol] = paintValueRef.current;
      }
    }
    setPaintVersion((value) => value + 1);
  };

  const updateRect = (row: number, col: number) => {
    const start = dragStartRef.current;
    if (!start) return;
    setLiveRect({
      startRow: Math.min(start.row, row),
      endRow: Math.max(start.row, row),
      startCol: Math.min(start.col, col),
      endCol: Math.max(start.col, col)
    });
  };

  const applyRect = () => {
    if (!liveRect) return;
    const next = maskOperation === "replace" ? createMask(width, height, false) : [...currentMask()];
    for (let row = liveRect.startRow; row <= liveRect.endRow; row += 1) {
      for (let col = liveRect.startCol; col <= liveRect.endCol; col += 1) {
        next[row * width + col] = maskOperation !== "remove";
      }
    }
    onCommit(next);
    setLiveRect(null);
  };

  return (
    <canvas
      ref={canvasRef}
      className="subject-mask-canvas"
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const cell = cellFromEvent(event);
        if (maskTool === "rectangle") {
          dragStartRef.current = cell;
          updateRect(cell.row, cell.col);
          return;
        }
        draftMaskRef.current = [...currentMask()];
        if (maskTool === "grid") {
          paintValueRef.current = !draftMaskRef.current[cell.row * width + cell.col];
          draftMaskRef.current[cell.row * width + cell.col] = paintValueRef.current;
          setPaintVersion((value) => value + 1);
          return;
        }
        paintValueRef.current = maskTool === "brush-add";
        paintAt(cell.row, cell.col);
      }}
      onPointerMove={(event) => {
        event.preventDefault();
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const cell = cellFromEvent(event);
        if (maskTool === "rectangle") {
          updateRect(cell.row, cell.col);
          return;
        }
        if (maskTool === "grid" && draftMaskRef.current) {
          draftMaskRef.current[cell.row * width + cell.col] = paintValueRef.current;
          setPaintVersion((value) => value + 1);
          return;
        }
        paintAt(cell.row, cell.col);
      }}
      onPointerUp={(event) => {
        event.preventDefault();
        if (maskTool === "rectangle") {
          applyRect();
        } else if (draftMaskRef.current) {
          onCommit(draftMaskRef.current);
          draftMaskRef.current = null;
        }
        dragStartRef.current = null;
      }}
      onPointerCancel={() => {
        draftMaskRef.current = null;
        dragStartRef.current = null;
        setLiveRect(null);
      }}
    />
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
        if (isEmptyOrTransparentCell(item)) {
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

function createMask(width: number, height: number, selected: boolean): boolean[] {
  return Array.from({ length: width * height }, () => selected);
}

function invertMask(mask: boolean[]): boolean[] {
  return mask.map((value) => !value);
}

function countSelected(maskGrid: boolean[] | null, width: number, height: number): number {
  if (!maskGrid) return width * height;
  return maskGrid.reduce((sum, selected) => sum + (selected ? 1 : 0), 0);
}

function drawChecker(ctx: CanvasRenderingContext2D, width: number, height: number, cell: number) {
  const checker = Math.max(6, Math.floor(cell / 2));
  for (let y = 0; y < height; y += checker) {
    for (let x = 0; x < width; x += checker) {
      ctx.fillStyle = (Math.floor(x / checker) + Math.floor(y / checker)) % 2 === 0 ? "#fffdf8" : "#f3eadf";
      ctx.fillRect(x, y, checker, checker);
    }
  }
}
