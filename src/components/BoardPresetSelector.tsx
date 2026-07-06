import { boardPresets } from "../data/boardPresets";

export function BoardPresetSelector({
  width,
  height,
  onChange
}: {
  width: number;
  height: number;
  onChange: (width: number, height: number) => void;
}) {
  return (
    <div className="panel">
      <h3>板子尺寸</h3>
      <div className="preset-grid">
        {boardPresets.map((preset) => (
          <button
            key={preset.id}
            className={width === preset.width && height === preset.height ? "active" : ""}
            onClick={() => onChange(preset.width, preset.height)}
          >
            <strong>{preset.label}</strong>
            <span>{preset.description ?? `${preset.width}×${preset.height}`}</span>
          </button>
        ))}
      </div>
      <div className="inline-fields">
        <label>
          自訂寬
          <input type="number" min={1} max={120} value={width} onChange={(e) => onChange(Math.min(120, Math.max(1, Number(e.target.value))), height)} />
        </label>
        <label>
          自訂高
          <input type="number" min={1} max={120} value={height} onChange={(e) => onChange(width, Math.min(120, Math.max(1, Number(e.target.value))))} />
        </label>
      </div>
    </div>
  );
}
