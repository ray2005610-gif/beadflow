import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import type { InventoryItem } from "../types/inventory";
import type { PatternProject, PatternStatus } from "../types/project";
import type { ActiveTool } from "./DrawingToolbar";
import type { BoardLayout, PatternRenderMode, SelectedCell } from "../types/craft";
import { calculateColorStats, totalCells } from "../utils/patternStats";
import { createBoardLayout, DEFAULT_BOARD_CONFIG, storageKeyForCraft } from "../utils/craftViewUtils";
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
  const boardLayout = useMemo(() => createBoardLayout(project.size.width, project.size.height, DEFAULT_BOARD_CONFIG), [project.size.height, project.size.width]);
  const [craftMode, setCraftMode] = useState(false);
  const [renderMode, setRenderMode] = useState<PatternRenderMode>("grid");
  const [focusedBoardId, setFocusedBoardId] = useState<string | null>(null);
  const [boardCompletionMode, setBoardCompletionMode] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const [fitRequestKey, setFitRequestKey] = useState(0);
  const [clearSelectionKey, setClearSelectionKey] = useState(0);
  const [completedBoardIds, setCompletedBoardIds] = useState<string[]>(() => readCompletedBoardIds(project.id, boardLayout));
  const [paletteCollapsed, setPaletteCollapsed] = useState(() => localStorage.getItem("paletteCollapsed") !== "false");
  const togglePalette = () => {
    setPaletteCollapsed((current) => {
      const next = !current;
      localStorage.setItem("paletteCollapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    setCompletedBoardIds(readCompletedBoardIds(project.id, boardLayout));
    setFocusedBoardId(null);
    setSelectedCell(null);
    setBoardCompletionMode(false);
  }, [project.id, boardLayout]);

  const saveCompletedBoards = (ids: string[]) => {
    const valid = ids.filter((id) => boardLayout.tiles.some((tile) => tile.id === id));
    setCompletedBoardIds(valid);
    localStorage.setItem(storageKeyForCraft(project.id), JSON.stringify(valid));
  };

  const enterCraftMode = () => {
    setCraftMode(true);
    onToolChange("inspect");
  };

  const leaveCraftMode = () => {
    setCraftMode(false);
    setBoardCompletionMode(false);
    setFocusedBoardId(null);
    setSelectedCell(null);
    setClearSelectionKey((value) => value + 1);
  };

  const focusBoard = (boardId: string | null) => {
    setFocusedBoardId(boardId);
    setFitRequestKey((value) => value + 1);
  };

  const moveBoardFocus = (delta: number) => {
    if (boardLayout.totalBoards <= 1) return;
    const currentIndex = Math.max(0, boardLayout.tiles.findIndex((tile) => tile.id === focusedBoardId));
    const nextIndex = (currentIndex + delta + boardLayout.tiles.length) % boardLayout.tiles.length;
    focusBoard(boardLayout.tiles[nextIndex].id);
  };

  const toggleBoardComplete = (boardId: string) => {
    saveCompletedBoards(completedBoardIds.includes(boardId)
      ? completedBoardIds.filter((id) => id !== boardId)
      : [...completedBoardIds, boardId]);
  };

  const clearCompletedBoards = () => {
    if (!completedBoardIds.length) return;
    if (window.confirm("確定要清除所有完成區塊嗎？")) saveCompletedBoards([]);
  };

  return (
    <main className={paletteCollapsed ? "editor-layout palette-collapsed" : "editor-layout"}>
      <section className="editor-main">
        {craftMode ? (
          <CraftToolbar
            renderMode={renderMode}
            showCoordinates={showCoordinates}
            selectedColorCode={selectedColorCode}
            boardCompletionMode={boardCompletionMode}
            completedCount={completedBoardIds.length}
            boardCount={boardLayout.totalBoards}
            focusedBoardId={focusedBoardId}
            boardLayout={boardLayout}
            onLeaveCraftMode={leaveCraftMode}
            onRenderModeChange={setRenderMode}
            onToggleCoordinates={onToggleCoordinates}
            onClearSelection={() => {
              setSelectedCell(null);
              setClearSelectionKey((value) => value + 1);
            }}
            onClearHighlight={() => onSelectedColorChange(null)}
            onToggleBoardCompletionMode={() => setBoardCompletionMode((value) => !value)}
            onClearCompletedBoards={clearCompletedBoards}
            onFitAll={() => focusBoard(null)}
            onPrevBoard={() => moveBoardFocus(-1)}
            onNextBoard={() => moveBoardFocus(1)}
          />
        ) : (
          <>
            <div className="bf-craft-entry">
              <button type="button" className="primary" onClick={enterCraftMode}>進入製作模式</button>
              <span>製作模式會顯示固定座標尺、拼板、定位與拼豆預覽，不會修改圖紙內容。</span>
            </div>
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
          </>
        )}
        {craftMode && (
          <BoardPanel
            project={project}
            boardLayout={boardLayout}
            focusedBoardId={focusedBoardId}
            completedBoardIds={completedBoardIds}
            selectedCell={selectedCell}
            onFocusBoard={focusBoard}
            onToggleBoardComplete={toggleBoardComplete}
          />
        )}
        <PatternCanvas
          grid={project.grid}
          activeTool={activeTool}
          selectedColorCode={selectedColorCode}
          showGrid={showGrid}
          showSymbols={showSymbols}
          showCoordinates={showCoordinates}
          onlyUnfinished={onlyUnfinished}
          renderMode={renderMode}
          craftMode={craftMode}
          boardLayout={boardLayout}
          focusedBoardId={focusedBoardId}
          completedBoardIds={completedBoardIds}
          boardCompletionMode={boardCompletionMode}
          fitRequestKey={fitRequestKey}
          clearSelectionKey={clearSelectionKey}
          onCellAction={onCellAction}
          onSelectedCellChange={setSelectedCell}
          onToggleBoardComplete={toggleBoardComplete}
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

function CraftToolbar({
  renderMode,
  showCoordinates,
  selectedColorCode,
  boardCompletionMode,
  completedCount,
  boardCount,
  focusedBoardId,
  boardLayout,
  onLeaveCraftMode,
  onRenderModeChange,
  onToggleCoordinates,
  onClearSelection,
  onClearHighlight,
  onToggleBoardCompletionMode,
  onClearCompletedBoards,
  onFitAll,
  onPrevBoard,
  onNextBoard
}: {
  renderMode: PatternRenderMode;
  showCoordinates: boolean;
  selectedColorCode: string | null;
  boardCompletionMode: boolean;
  completedCount: number;
  boardCount: number;
  focusedBoardId: string | null;
  boardLayout: BoardLayout;
  onLeaveCraftMode: () => void;
  onRenderModeChange: (mode: PatternRenderMode) => void;
  onToggleCoordinates: () => void;
  onClearSelection: () => void;
  onClearHighlight: () => void;
  onToggleBoardCompletionMode: () => void;
  onClearCompletedBoards: () => void;
  onFitAll: () => void;
  onPrevBoard: () => void;
  onNextBoard: () => void;
}) {
  const currentTile = boardLayout.tiles.find((tile) => tile.id === focusedBoardId);
  return (
    <div className="bf-craft-toolbar" aria-label="製作模式工具列">
      <div className="bf-toolbar-group">
        <span>模式</span>
        <button type="button" className="bf-tool-button-active">製作模式</button>
        <button type="button" onClick={onLeaveCraftMode}>離開製作模式</button>
      </div>
      <div className="bf-toolbar-group bf-render-mode-switch">
        <span>顯示</span>
        <button type="button" className={renderMode === "grid" ? "bf-tool-button-active" : ""} onClick={() => onRenderModeChange("grid")}>圖紙模式</button>
        <button type="button" className={renderMode === "beads" ? "bf-tool-button-active" : ""} onClick={() => onRenderModeChange("beads")}>拼豆預覽</button>
      </div>
      <div className="bf-toolbar-group">
        <span>定位</span>
        <button type="button" className={showCoordinates ? "bf-tool-button-active" : ""} onClick={onToggleCoordinates}>座標追蹤</button>
        <button type="button" onClick={onClearSelection}>清除定位</button>
      </div>
      <div className="bf-toolbar-group">
        <span>高亮</span>
        <strong>{selectedColorCode ? `目前色號 ${selectedColorCode}` : "未選色號"}</strong>
        <button type="button" onClick={onClearHighlight} disabled={!selectedColorCode}>清除高亮</button>
      </div>
      <div className="bf-toolbar-group">
        <span>區塊</span>
        <button type="button" className={boardCompletionMode ? "bf-tool-button-active" : ""} onClick={onToggleBoardCompletionMode}>完成區塊模式</button>
        <button type="button" onClick={onClearCompletedBoards} disabled={!completedCount}>全部取消完成</button>
        <strong>已完成區塊：{completedCount} / {boardCount}</strong>
      </div>
      <div className="bf-toolbar-group">
        <span>拼板</span>
        <button type="button" onClick={onFitAll}>查看全部</button>
        {boardCount > 1 && <button type="button" onClick={onPrevBoard}>上一塊</button>}
        {boardCount > 1 && <button type="button" onClick={onNextBoard}>下一塊</button>}
        <strong>{currentTile ? `目前查看：第 ${currentTile.index} 塊` : "目前查看：全部"}</strong>
      </div>
    </div>
  );
}

function BoardPanel({
  project,
  boardLayout,
  focusedBoardId,
  completedBoardIds,
  selectedCell,
  onFocusBoard,
  onToggleBoardComplete
}: {
  project: PatternProject;
  boardLayout: BoardLayout;
  focusedBoardId: string | null;
  completedBoardIds: string[];
  selectedCell: SelectedCell;
  onFocusBoard: (boardId: string | null) => void;
  onToggleBoardComplete: (boardId: string) => void;
}) {
  return (
    <div className="bf-board-panel">
      <div className="bf-board-summary">
        <span>圖紙尺寸：{project.size.width}×{project.size.height}</span>
        <span>單板尺寸：{DEFAULT_BOARD_CONFIG.boardWidth}×{DEFAULT_BOARD_CONFIG.boardHeight}</span>
        <span>拼板配置：{boardLayout.boardColumns}×{boardLayout.boardRows}</span>
        <span>需要拼板：{boardLayout.totalBoards} 塊</span>
        {selectedCell && <span>目前格子：第 {selectedCell.col + 1} 欄 / 第 {selectedCell.row + 1} 列</span>}
      </div>
      <div className="bf-board-grid" style={{ gridTemplateColumns: `repeat(${boardLayout.boardColumns}, minmax(54px, 1fr))` }}>
        {boardLayout.tiles.map((tile) => {
          const completed = completedBoardIds.includes(tile.id);
          const active = focusedBoardId === tile.id;
          return (
            <button
              key={tile.id}
              type="button"
              className={`bf-board-tile${active ? " bf-board-tile-active" : ""}${completed ? " bf-board-tile-completed" : ""}`}
              onClick={() => onFocusBoard(tile.id)}
              onDoubleClick={() => onToggleBoardComplete(tile.id)}
            >
              <strong>{tile.index}</strong>
              <span>{tile.endCol - tile.startCol}×{tile.endRow - tile.startRow}</span>
              {completed && <em>完成</em>}
            </button>
          );
        })}
      </div>
      <p className="muted-note">單擊聚焦拼板；開啟完成區塊模式後，直接在圖紙上點拼板可切換完成。也可在這裡雙擊拼板切換完成。</p>
    </div>
  );
}

function AccordionSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const buttonId = useId();
  const panelId = useId();
  return (
    <section className="panel accordion-panel">
      <button
        id={buttonId}
        className="accordion-trigger"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span>{title}</span>
        <span aria-hidden="true">{open ? "收合" : "展開"}</span>
      </button>
      {open && <div id={panelId} className="accordion-content" role="region" aria-labelledby={buttonId}>{children}</div>}
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

function readCompletedBoardIds(projectId: string, boardLayout: BoardLayout): string[] {
  try {
    const raw = localStorage.getItem(storageKeyForCraft(projectId));
    const ids = raw ? JSON.parse(raw) as string[] : [];
    return ids.filter((id) => boardLayout.tiles.some((tile) => tile.id === id));
  } catch {
    localStorage.removeItem(storageKeyForCraft(projectId));
    return [];
  }
}


