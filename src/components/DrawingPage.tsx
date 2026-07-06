import { useState } from "react";
import type { PatternProject } from "../types/project";
import { visiblePalette } from "../data/recognitionPalette";
import { createBlankPattern } from "../utils/imageToPattern";
import { BoardPresetSelector } from "./BoardPresetSelector";

export function DrawingPage({ onProjectReady }: { onProjectReady: (project: PatternProject) => void }) {
  const [width, setWidth] = useState(52);
  const [height, setHeight] = useState(52);
  const [name, setName] = useState("手動畫格圖紙");

  const create = () => {
    const now = new Date().toISOString();
    onProjectReady({
      id: crypto.randomUUID(),
      name,
      sourceType: "manual_drawing",
      size: { width, height },
      grid: createBlankPattern(width, height, visiblePalette.find((color) => color.code === "H2") ?? visiblePalette[0]),
      createdAt: now,
      updatedAt: now,
      status: "draft",
      tags: []
    });
  };

  return (
    <main className="workspace narrow">
      <div className="panel">
        <h2>手動畫圖紙</h2>
        <label>圖紙名稱<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      </div>
      <BoardPresetSelector width={width} height={height} onChange={(nextWidth, nextHeight) => { setWidth(nextWidth); setHeight(nextHeight); }} />
      <button className="primary wide" onClick={create}>建立空白圖紙</button>
    </main>
  );
}
