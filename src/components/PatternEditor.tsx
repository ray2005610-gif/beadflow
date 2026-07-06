import { useMemo } from "react";
import type { InventoryItem } from "../types/inventory";
import type { PatternProject, PatternStatus } from "../types/project";
import type { ActiveTool } from "./DrawingToolbar";
import { calculateColorStats } from "../utils/patternStats";
import { PatternCanvas } from "./PatternCanvas";
import { Toolbar } from "./Toolbar";
import { PalettePanel } from "./PalettePanel";
import { ColorStatsPanel } from "./ColorStatsPanel";
import { RecognitionReviewPanel } from "./RecognitionReviewPanel";
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
  onToolChange,
  onEnterCorrectionMode,
  onLeaveCorrectionMode,
  onBrushColorChange,
  onSelectedColorChange,
  onCellAction,
  onSave,
  onExport,
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
  onToolChange: (tool: ActiveTool) => void;
  onEnterCorrectionMode: () => void;
  onLeaveCorrectionMode: () => void;
  onBrushColorChange: (code: string) => void;
  onSelectedColorChange: (code: string | null) => void;
  onCellAction: (row: number, col: number, tool: ActiveTool) => void;
  onSave: () => void;
  onExport: () => void;
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
  return (
    <main className="editor-layout">
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
          onToolChange={onToolChange}
          onEnterCorrectionMode={onEnterCorrectionMode}
          onLeaveCorrectionMode={onLeaveCorrectionMode}
          onToggleGrid={onToggleGrid}
          onToggleSymbols={onToggleSymbols}
          onToggleCoordinates={onToggleCoordinates}
          onToggleOnlyUnfinished={onToggleOnlyUnfinished}
          onSave={onSave}
          onExport={onExport}
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
      <aside className="left-rail">
        <PalettePanel selectedCode={brushColorCode} recentColors={recentColors} onSelect={onBrushColorChange} />
      </aside>
      <aside className="right-rail">
        <ProjectDetailPanel project={project} onRename={onRename} onStatusChange={onStatusChange} />
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
        {project.sourceType === "grid_recognition" && <RecognitionReviewPanel grid={project.grid} threshold={0.75} onSelectColor={onSelectedColorChange} />}
        <InventoryPanel inventory={inventory} stats={stats} onChange={onInventoryChange} onConsume={onConsumeInventory} />
      </aside>
    </main>
  );
}
