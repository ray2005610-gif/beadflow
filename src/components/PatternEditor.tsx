import { useMemo, useState, type ReactNode } from "react";
import type { InventoryItem } from "../types/inventory";
import type { PatternProject, PatternStatus } from "../types/project";
import type { ActiveTool } from "./DrawingToolbar";
import { calculateColorStats, totalCells } from "../utils/patternStats";
import { PatternCanvas } from "./PatternCanvas";
import { Toolbar } from "./Toolbar";
import { PalettePanel } from "./PalettePanel";
import { ColorStatsPanel } from "./ColorStatsPanel";
import { InventoryPanel } from "./InventoryPanel";
import { ProjectDetailPanel } from "./ProjectDetailPanel";

export function PatternEditor({
  project,
  inventory,
  activeTool,
  brushColorCode,
  selectedColorCode,
  recentColors,
  showGrid,
  showSymbols,
  showCoordinates,
  onlyUnfinished,
  correctionMode,
  mirrorActive,
  onToolChange,
  onEnterCorrectionMode,
  onLeaveCorrectionMode,
  onBrushColorChange,
  onSelectedColorChange,
  onCellAction,
  onSave,
  onExport,
  onExportMirror,
  onMirrorHorizontal,
  onMirrorVertical,
  onRestoreMirror,
  onInventoryChange,
  onConsumeInventory,
  onRename,
  onStatusChange,
  onCompleteColor,
  onClearCompleteColor,
  onPrevColor,
  onNextColor,
  onToggleGrid,
  onToggleSymbols,
  onToggleCoordinates,
  onToggleOnlyUnfinished
}: {
  project: PatternProject;
  inventory: InventoryItem[];
  activeTool: ActiveTool;
  brushColorCode: string;
  selectedColorCode: string | null;
  recentColors: string[];
  showGrid: boolean;
  showSymbols: boolean;
  showCoordinates: boolean;
  onlyUnfinished: boolean;
  correctionMode: boolean;
  mirrorActive: boolean;
  onToolChange: (tool: ActiveTool) => void;
  onEnterCorrectionMode: () => void;
  onLeaveCorrectionMode: () => void;
  onBrushColorChange: (code: string) => void;
  onSelectedColorChange: (code: string | null) => void;
  onCellAction: (row: number, col: number, tool: ActiveTool) => void;
  onSave: () => void;
  onExport: () => void;
  onExportMirror: () => void;
  onMirrorHorizontal: () => void;
  onMirrorVertical: () => void;
  onRestoreMirror: () => void;
  onInventoryChange: (items: InventoryItem[]) => void;
  onConsumeInventory: () => void;
  onRename: (name: string) => void;
  onStatusChange: (status: PatternStatus) => void;
  onCompleteColor: (code: string) => void;
  onClearCompleteColor: (code: string) => void;
  onPrevColor: () => void;
  onNextColor: () => void;
  onToggleGrid: () => void;
  onToggleSymbols: () => void;
  onToggleCoordinates: () => void;
  onToggleOnlyUnfinished: () => void;
}) {
  const stats = useMemo(() => calculateColorStats(project.grid), [project.grid]);
  const canDirectEdit = project.sourceType === "manual_drawing";
  const [paletteCollapsed, setPaletteCollapsed] = useState(() => localStorage.getItem("paletteCollapsed") !== "false");
  const togglePalette = () => {
    setPaletteCollapsed((current) => {
      const next = !current;
      localStorage.setItem("paletteCollapsed", String(next));
      return next;
    });
  };

  return (
    <main className={paletteCollapsed ? "editor-layout palette-collapsed" : "editor-layout"}>
      <section className="editor-main">
        <Toolbar
          activeTool={activeTool}
          showGrid={showGrid}
          showSymbols={showSymbols}
          showCoordinates={showCoordinates}
          onlyUnfinished={onlyUnfinished}
          canDirectEdit={canDirectEdit}
          correctionMode={correctionMode}
          selectedColorCode={selectedColorCode}
          mirrorActive={mirrorActive}
          onToolChange={onToolChange}
          onEnterCorrectionMode={onEnterCorrectionMode}
          onLeaveCorrectionMode={onLeaveCorrectionMode}
          onToggleGrid={onToggleGrid}
          onToggleSymbols={onToggleSymbols}
          onToggleCoordinates={onToggleCoordinates}
          onToggleOnlyUnfinished={onToggleOnlyUnfinished}
          onMirrorHorizontal={onMirrorHorizontal}
          onMirrorVertical={onMirrorVertical}
          onRestoreMirror={onRestoreMirror}
          onSave={onSave}
          onExport={onExport}
          onExportMirror={onExportMirror}
        />
        <PatternCanvas
          grid={project.grid}
          activeTool={activeTool}
          selectedColorCode={selectedColorCode}
          showGrid={showGrid}
          showSymbols={showSymbols}
          showCoordinates={showCoordinates}
          onlyUnfinished={onlyUnfinished}
          onCellAction={onCellAction}
        />
      </section>
      <aside className="left-rail palette-rail">
        <button className="palette-toggle" onClick={togglePalette}>{paletteCollapsed ? "展開色卡" : "收合色卡"}</button>
        {!paletteCollapsed && <PalettePanel selectedCode={brushColorCode} recentColors={recentColors} onSelect={onBrushColorChange} />}
      </aside>
      <aside className="right-rail">
        <AccordionSection title="圖紙資訊" defaultOpen>
          <ProjectDetailPanel project={project} onRename={onRename} onStatusChange={onStatusChange} />
        </AccordionSection>
        <AccordionSection title="商業成本" defaultOpen>
          <CostEstimatePanel project={project} colorCount={stats.length} />
        </AccordionSection>
        <AccordionSection title="色號統計" defaultOpen>
          <ColorStatsPanel
            stats={stats}
            inventory={inventory}
            selectedColorCode={selectedColorCode}
            onlyUnfinished={onlyUnfinished}
            onSelect={onSelectedColorChange}
            onBrush={onBrushColorChange}
            onCompleteColor={onCompleteColor}
            onClearCompleteColor={onClearCompleteColor}
            onPrev={onPrevColor}
            onNext={onNextColor}
            onToggleOnlyUnfinished={onToggleOnlyUnfinished}
          />
        </AccordionSection>
        <AccordionSection title="庫存管理">
          <InventoryPanel inventory={inventory} stats={stats} onChange={onInventoryChange} onConsume={onConsumeInventory} />
        </AccordionSection>
      </aside>
    </main>
  );
}

function AccordionSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="panel accordion-panel">
      <button className="accordion-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>{title}</span>
        <span aria-hidden="true">{open ? "收合" : "展開"}</span>
      </button>
      {open && <div className="accordion-content">{children}</div>}
    </section>
  );
}

function CostEstimatePanel({ project, colorCount }: { project: PatternProject; colorCount: number }) {
  const [costPerBead, setCostPerBead] = useState(0.1);
  const [includeBackground, setIncludeBackground] = useState(false);
  const beadCount = totalCells(project.grid);
  const boardCells = project.size.width * project.size.height;
  const blankCells = boardCells - beadCount;
  const materialCost = beadCount * costPerBead;
  return (
    <div className="cost-panel">
      <dl className="meta-grid compact-meta">
        <div><dt>底板尺寸</dt><dd>{project.size.width} × {project.size.height}</dd></div>
        <div><dt>實際豆數</dt><dd>{beadCount.toLocaleString("zh-TW")} 顆</dd></div>
        <div><dt>空白 / 留白</dt><dd>{blankCells.toLocaleString("zh-TW")} 格</dd></div>
        <div><dt>使用顏色</dt><dd>{colorCount} 色</dd></div>
      </dl>
      <label>
        單顆成本（元）
        <input type="number" min={0} step={0.01} value={costPerBead} onChange={(event) => setCostPerBead(Number(event.target.value))} />
      </label>
      <label className="checkbox-row">
        <input type="checkbox" checked={includeBackground} onChange={(event) => setIncludeBackground(event.target.checked)} />
        背景若已轉成豆子則計入成本
      </label>
      <p className="cost-total">預估材料成本：{Math.round(materialCost).toLocaleString("zh-TW")} 元</p>
      <p className="muted-note">留白與透明格不計入成本。</p>
    </div>
  );
}
