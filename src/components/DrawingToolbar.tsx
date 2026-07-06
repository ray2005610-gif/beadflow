export type ActiveTool = "inspect" | "paint" | "eraser" | "eyedropper" | "fill" | "replaceColor";

const tools: Array<{ id: ActiveTool; label: string }> = [
  { id: "inspect", label: "檢查" },
  { id: "paint", label: "畫筆" },
  { id: "eraser", label: "橡皮擦" },
  { id: "eyedropper", label: "取色" },
  { id: "fill", label: "油漆桶" },
  { id: "replaceColor", label: "替換色號" }
];

export function DrawingToolbar({ activeTool, onChange }: { activeTool: ActiveTool; onChange: (tool: ActiveTool) => void }) {
  return (
    <div className="toolbar">
      {tools.map((tool) => (
        <button key={tool.id} className={activeTool === tool.id ? "active" : ""} onClick={() => onChange(tool.id)}>
          {tool.label}
        </button>
      ))}
    </div>
  );
}
