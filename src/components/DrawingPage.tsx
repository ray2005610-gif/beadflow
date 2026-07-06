import { useState } from "react";
import type { PatternProject } from "../types/project";
import { mardPalette } from "../data/mardPalette";
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
      grid: createBlankPattern(width, height, mardPalette.find((c) => c.code === "H2") ?? mardPalette[0]),
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
        <label>圖紙名稱<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      </div>
      <BoardPresetSelector width={width} height={height} onChange={(w, h) => { setWidth(w); setHeight(h); }} />
      <button className="primary wide" onClick={create}>新增空白圖紙</button>
    </main>
  );
}
