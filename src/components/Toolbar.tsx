import type { ActiveTool } from "./DrawingToolbar";

const editTools: Array<{ id: ActiveTool; label: string }> = [
  { id: "paint", label: "畫筆" },
  { id: "eraser", label: "橡皮擦" },
  { id: "eyedropper", label: "取色" },
  { id: "fill", label: "油漆桶" }
];

export function Toolbar({
  activeTool,
  showGrid,
  showSymbols,
  showCoordinates,
  onlyUnfinished,
  canDirectEdit,
  correctionMode,
  selectedColorCode,
  onToolChange,
  onEnterCorrectionMode,
  onLeaveCorrectionMode,
  onToggleGrid,
  onToggleSymbols,
  onToggleCoordinates,
  onToggleOnlyUnfinished,
  onExport,
  onSave
}: {
  activeTool: ActiveTool;
  showGrid: boolean;
  showSymbols: boolean;
  showCoordinates: boolean;
  onlyUnfinished: boolean;
  canDirectEdit: boolean;
  correctionMode: boolean;
  selectedColorCode: string | null;
  onToolChange: (tool: ActiveTool) => void;
  onEnterCorrectionMode: () => void;
  onLeaveCorrectionMode: () => void;
  onToggleGrid: () => void;
  onToggleSymbols: () => void;
  onToggleCoordinates: () => void;
  onToggleOnlyUnfinished: () => void;
  onExport: () => void;
  onSave: () => void;
}) {
  const allowEditingTools = canDirectEdit || correctionMode;
  return (
    <div className="toolbar-wrap">
      <div className="toolbar wrap">
        {allowEditingTools ? (
          editTools.map((tool) => (
            <button key={tool.id} className={activeTool === tool.id ? "active" : ""} onClick={() => onToolChange(tool.id)}>
              {tool.label}
            </button>
          ))
        ) : (
          <button onClick={onEnterCorrectionMode}>進入修正模式</button>
        )}
        {correctionMode && !canDirectEdit && <button onClick={onLeaveCorrectionMode}>離開修正模式</button>}
        <button className={activeTool === "replaceColor" ? "active" : ""} onClick={() => onToolChange("replaceColor")}>替換色號</button>
        <button className={showGrid ? "active" : ""} onClick={onToggleGrid}>格線</button>
        <button className={showSymbols ? "active" : ""} onClick={onToggleSymbols}>色號</button>
        <button className={showCoordinates ? "active" : ""} onClick={onToggleCoordinates}>座標</button>
        <button className={onlyUnfinished ? "active" : ""} onClick={onToggleOnlyUnfinished} disabled={!selectedColorCode}>只看未完成</button>
        <button onClick={onSave}>儲存圖紙</button>
        <button onClick={onExport}>匯出 PNG</button>
      </div>
      {correctionMode && !canDirectEdit && (
        <div className="mode-warning">目前為修正模式，點擊格子會修改圖紙顏色。</div>
      )}
    </div>
  );
}
