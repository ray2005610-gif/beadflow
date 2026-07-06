import { useEffect, useMemo, useState } from "react";
import { visiblePalette } from "./data/recognitionPalette";
import type { BeadColor } from "./types/bead";
import type { InventoryItem, InventoryTransaction } from "./types/inventory";
import type { PatternCell, PatternGrid } from "./types/pattern";
import type { PatternProject, PatternStatus } from "./types/project";
import { consumeInventory } from "./utils/inventoryUtils";
import { storage } from "./utils/storageUtils";
import { exportPatternPng } from "./utils/exportUtils";
import { createEmptyCell } from "./utils/imageToPattern";
import { findClosestBeadColorWithDebug, hexToRgb } from "./utils/colorUtils";
import { Layout } from "./components/Layout";
import { ModeSelector, type AppMode } from "./components/ModeSelector";
import { GridImportPage } from "./components/GridImportPage";
import { DrawingPage } from "./components/DrawingPage";
import { PhotoToPatternPage } from "./components/PhotoToPatternPage";
import { PatternEditor } from "./components/PatternEditor";
import { ProjectLibrary } from "./components/ProjectLibrary";
import type { ActiveTool } from "./components/DrawingToolbar";
import { calculateColorStats } from "./utils/patternStats";

const editOnlyTools: ActiveTool[] = ["paint", "eraser", "eyedropper", "fill"];

type MirrorAxis = "horizontal" | "vertical";

export default function App() {
  const [mode, setMode] = useState<AppMode>("grid");
  const [project, setProject] = useState<PatternProject | null>(null);
  const [projects, setProjects] = useState<PatternProject[]>(() => storage.getProjects().map(sanitizeProjectPalette));
  const [inventory, setInventory] = useState<InventoryItem[]>(() => initialInventory());
  const [transactions, setTransactions] = useState<InventoryTransaction[]>(() => storage.getTransactions());
  const [activeTool, setActiveTool] = useState<ActiveTool>("inspect");
  const [brushColorCode, setBrushColorCode] = useState(visiblePalette[0]?.code ?? "A1");
  const [selectedColorCode, setSelectedColorCode] = useState<string | null>(null);
  const [recentColors, setRecentColors] = useState<string[]>(() => storage.getRecentColors().filter((code) => visiblePalette.some((color) => color.code === code)));
  const [showGrid, setShowGrid] = useState(true);
  const [showSymbols, setShowSymbols] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [onlyUnfinished, setOnlyUnfinished] = useState(false);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [mirrorOriginalGrid, setMirrorOriginalGrid] = useState<PatternGrid | null>(null);
  const stats = useMemo(() => project ? calculateColorStats(project.grid) : [], [project]);

  useEffect(() => storage.saveProjects(projects), [projects]);
  useEffect(() => storage.saveInventory(inventory), [inventory]);
  useEffect(() => storage.saveTransactions(transactions), [transactions]);
  useEffect(() => storage.saveRecentColors(recentColors), [recentColors]);

  const openProject = (nextProject: PatternProject | null) => {
    setProject(nextProject ? sanitizeProjectPalette(nextProject) : null);
    setMirrorOriginalGrid(null);
    setCorrectionMode(false);
    setActiveTool(nextProject?.sourceType === "manual_drawing" ? "paint" : "inspect");
    setSelectedColorCode(null);
    setOnlyUnfinished(false);
  };

  const selectBrush = (code: string) => {
    if (!visiblePalette.some((color) => color.code === code)) return;
    setBrushColorCode(code);
    setRecentColors((items) => [code, ...items.filter((item) => item !== code)].slice(0, 12));
  };

  const updateProject = (patch: Partial<PatternProject>) => {
    setProject((current) => current ? { ...current, ...patch, updatedAt: new Date().toISOString() } : current);
  };

  const setGrid = (grid: PatternGrid) => {
    setProject((current) => current ? { ...current, grid, updatedAt: new Date().toISOString() } : current);
  };

  const mirrorProject = (axis: MirrorAxis) => {
    if (!project) return;
    setMirrorOriginalGrid((current) => current ?? project.grid);
    setGrid(mirrorGrid(project.grid, axis));
  };

  const restoreMirror = () => {
    if (!mirrorOriginalGrid) return;
    setGrid(mirrorOriginalGrid);
    setMirrorOriginalGrid(null);
  };

  const handleCellAction = (row: number, col: number, tool: ActiveTool) => {
    if (!project) return;
    const canUseEditTools = project.sourceType === "manual_drawing" || correctionMode;
    if (!canUseEditTools && editOnlyTools.includes(tool)) return;
    const brush = visiblePalette.find((c) => c.code === brushColorCode) ?? visiblePalette[0];
    if (!brush) return;
    const clicked = project.grid[row][col];
    if (tool === "inspect") {
      setSelectedColorCode(clicked.empty || !clicked.colorCode ? null : clicked.colorCode);
      return;
    }
    if (tool === "eyedropper") {
      if (!clicked.empty && clicked.colorCode) selectBrush(clicked.colorCode);
      setActiveTool("paint");
      return;
    }
    if (tool === "replaceColor") {
      setGrid(project.grid.map((line) => line.map((cell) => sameFillTarget(cell, clicked) ? colorCell(cell, brush) : cell)));
      return;
    }
    if (tool === "fill") {
      setGrid(floodFill(project.grid, row, col, brush));
      return;
    }
    setGrid(project.grid.map((line, r) => line.map((cell, c) => {
      if (r !== row || c !== col) return cell;
      if (tool === "eraser") return createEmptyCell(cell.row, cell.col, cell.rawRgb, cell.alpha);
      return colorCell(cell, brush);
    })));
  };

  const saveProject = () => {
    if (!project) return;
    const next = { ...project, updatedAt: new Date().toISOString() };
    setProject(next);
    setProjects((items) => [sanitizeProjectPalette(next), ...items.filter((item) => item.id !== next.id)]);
  };

  const deleteProject = (id: string) => {
    setProjects((items) => items.filter((item) => item.id !== id));
    if (project?.id === id) openProject(null);
  };

  const consumeCurrent = () => {
    const result = consumeInventory(stats, inventory);
    setInventory(result.inventory);
    setTransactions((items) => [...result.transactions, ...items]);
    updateProject({ status: "stock_out_done" });
  };

  const colorIndex = selectedColorCode ? stats.findIndex((item) => item.code === selectedColorCode) : -1;
  const moveSelected = (delta: number) => {
    if (!stats.length) return;
    const base = colorIndex >= 0 ? colorIndex : 0;
    const next = (base + delta + stats.length) % stats.length;
    setSelectedColorCode(stats[next].code);
  };

  return (
    <Layout>
      <ModeSelector mode={mode} onChange={(next) => { setMode(next); openProject(null); }} />
      {project ? (
        <>
          <div className="editor-topline">
            <button onClick={() => openProject(null)}>返回入口</button>
            <button onClick={saveProject}>儲存目前圖紙</button>
          </div>
          <PatternEditor
            project={project}
            inventory={inventory}
            activeTool={activeTool}
            brushColorCode={brushColorCode}
            selectedColorCode={selectedColorCode}
            recentColors={recentColors}
            showGrid={showGrid}
            showSymbols={showSymbols}
            showCoordinates={showCoordinates}
            onlyUnfinished={onlyUnfinished}
            correctionMode={correctionMode}
            mirrorActive={Boolean(mirrorOriginalGrid)}
            onToolChange={setActiveTool}
            onEnterCorrectionMode={() => { setCorrectionMode(true); setActiveTool("paint"); }}
            onLeaveCorrectionMode={() => { setCorrectionMode(false); setActiveTool("inspect"); }}
            onBrushColorChange={selectBrush}
            onSelectedColorChange={(code) => {
              setSelectedColorCode(code);
              if (!code) setOnlyUnfinished(false);
            }}
            onCellAction={handleCellAction}
            onSave={saveProject}
            onExport={() => exportPatternPng(project.name, project.grid, { showDone: true, showSymbols, showCoordinates, mirrored: Boolean(mirrorOriginalGrid) })}
            onExportMirror={() => exportPatternPng(project.name, mirrorOriginalGrid ? project.grid : mirrorGrid(project.grid, "horizontal"), { showDone: true, showSymbols, showCoordinates, mirrored: true })}
            onMirrorHorizontal={() => mirrorProject("horizontal")}
            onMirrorVertical={() => mirrorProject("vertical")}
            onRestoreMirror={restoreMirror}
            onInventoryChange={setInventory}
            onConsumeInventory={consumeCurrent}
            onRename={(name) => updateProject({ name })}
            onStatusChange={(status: PatternStatus) => updateProject({ status })}
            onCompleteColor={(code) => setGrid(project.grid.map((row) => row.map((cell) => !cell.empty && cell.colorCode === code ? { ...cell, done: true } : cell)))}
            onClearCompleteColor={(code) => setGrid(project.grid.map((row) => row.map((cell) => !cell.empty && cell.colorCode === code ? { ...cell, done: false } : cell)))}
            onPrevColor={() => moveSelected(-1)}
            onNextColor={() => moveSelected(1)}
            onToggleGrid={() => setShowGrid((v) => !v)}
            onToggleSymbols={() => setShowSymbols((v) => !v)}
            onToggleCoordinates={() => setShowCoordinates((v) => !v)}
            onToggleOnlyUnfinished={() => {
              if (selectedColorCode) setOnlyUnfinished((v) => !v);
            }}
          />
        </>
      ) : (
        <>
          {mode === "grid" && <GridImportPage onProjectReady={openProject} />}
          {mode === "drawing" && <DrawingPage onProjectReady={openProject} />}
          {mode === "photo" && <PhotoToPatternPage onProjectReady={openProject} />}
          <main className="workspace narrow">
            <ProjectLibrary projects={projects} onOpen={openProject} onDelete={deleteProject} />
          </main>
        </>
      )}
    </Layout>
  );
}

function initialInventory(): InventoryItem[] {
  const stored = storage.getInventory();
  if (stored.length) return stored.filter((item) => visiblePalette.some((color) => color.code === item.colorCode));
  return visiblePalette.map((color) => ({ colorCode: color.code, colorName: color.name, hex: color.hex, quantity: 0, warningThreshold: 100 }));
}

function colorCell(cell: PatternCell, color: BeadColor): PatternCell {
  return {
    ...cell,
    colorCode: color.code,
    colorName: color.name,
    hex: color.hex,
    symbol: color.symbol,
    done: false,
    empty: false
  };
}

function floodFill(grid: PatternGrid, row: number, col: number, color: BeadColor): PatternGrid {
  const target = grid[row][col];
  if (!target.empty && target.colorCode === color.code) return grid;
  const next = grid.map((line) => line.map((cell) => ({ ...cell })));
  const queue: Array<[number, number]> = [[row, col]];
  const seen = new Set<string>();
  while (queue.length) {
    const [r, c] = queue.shift()!;
    const key = `${r},${c}`;
    if (seen.has(key) || r < 0 || c < 0 || r >= next.length || c >= next[0].length || !sameFillTarget(next[r][c], target)) continue;
    seen.add(key);
    next[r][c] = colorCell(next[r][c], color);
    queue.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
  }
  return next;
}

function sameFillTarget(cell: PatternCell, target: PatternCell): boolean {
  if (target.empty || !target.colorCode) return Boolean(cell.empty || !cell.colorCode);
  return !cell.empty && cell.colorCode === target.colorCode;
}

function mirrorGrid(grid: PatternGrid, axis: MirrorAxis): PatternGrid {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  return Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, col) => {
      const sourceRow = axis === "vertical" ? height - 1 - row : row;
      const sourceCol = axis === "horizontal" ? width - 1 - col : col;
      const source = grid[sourceRow][sourceCol];
      return { ...source, row, col };
    })
  );
}

function sanitizeProjectPalette(project: PatternProject): PatternProject {
  const visibleCodes = new Set(visiblePalette.map((color) => color.code));
  let changed = false;
  const grid = project.grid.map((row) => row.map((cell) => {
    if (cell.empty || !cell.colorCode || visibleCodes.has(cell.colorCode)) return cell;
    const rgb = cell.rawRgb ?? safeHexToRgb(cell.hex);
    if (!rgb) {
      changed = true;
      return createEmptyCell(cell.row, cell.col, cell.rawRgb, cell.alpha, cell.sourceRow, cell.sourceCol);
    }
    const match = findClosestBeadColorWithDebug(rgb, visiblePalette);
    changed = true;
    return {
      ...cell,
      colorCode: match.color.code,
      colorName: match.color.name,
      hex: match.color.hex,
      symbol: match.color.symbol,
      matchedHex: match.color.hex,
      confidence: match.confidence,
      distance: match.distance,
      adjustedDistance: match.adjustedDistance,
      candidates: match.candidates,
      rawHue: match.rawHue,
      rawSaturation: match.rawSaturation,
      rawLightness: match.rawLightness
    };
  }));
  return changed ? { ...project, grid, updatedAt: new Date().toISOString() } : project;
}

function safeHexToRgb(hex: string) {
  try {
    if (!hex || hex === "transparent") return null;
    return hexToRgb(hex);
  } catch {
    return null;
  }
}
