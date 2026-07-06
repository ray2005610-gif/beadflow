export type AppMode = "grid" | "drawing" | "photo";

const modes: Array<{ id: AppMode; label: string }> = [
  { id: "grid", label: "辨識格線圖紙" },
  { id: "drawing", label: "手動畫圖紙" },
  { id: "photo", label: "照片轉拼豆" }
];

export function ModeSelector({ mode, onChange }: { mode: AppMode; onChange: (mode: AppMode) => void }) {
  return (
    <nav className="mode-selector">
      {modes.map((item) => (
        <button key={item.id} className={mode === item.id ? "active" : ""} onClick={() => onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
