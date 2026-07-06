import type { InventoryItem } from "../types/inventory";
import type { ColorStat } from "../types/pattern";

export function ColorStatsPanel({
  stats,
  inventory,
  selectedColorCode,
  onlyUnfinished,
  onSelect,
  onBrush,
  onCompleteColor,
  onClearCompleteColor,
  onPrev,
  onNext,
  onToggleOnlyUnfinished
}: {
  stats: ColorStat[];
  inventory: InventoryItem[];
  selectedColorCode: string | null;
  onlyUnfinished: boolean;
  onSelect: (code: string | null) => void;
  onBrush: (code: string) => void;
  onCompleteColor: (code: string) => void;
  onClearCompleteColor: (code: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleOnlyUnfinished: () => void;
}) {
  const sorted = [...stats].sort((a, b) => b.total - a.total);
  return (
    <div className="panel stats-panel">
      <h3>色號統計</h3>
      <div className="toolbar">
        <button onClick={onPrev} disabled={!stats.length}>上一色</button>
        <button onClick={onNext} disabled={!stats.length}>下一色</button>
        <button className={onlyUnfinished ? "active" : ""} onClick={onToggleOnlyUnfinished} disabled={!selectedColorCode}>只看未完成</button>
        <button onClick={() => onSelect(null)} disabled={!selectedColorCode}>清除高亮</button>
      </div>
      {selectedColorCode && <p className="highlight-note">目前高亮：{selectedColorCode}</p>}
      <div className="stat-list">
        {sorted.map((stat) => {
          const stock = inventory.find((item) => item.colorCode === stat.code)?.quantity ?? 0;
          const lacks = stock < stat.remaining;
          const active = selectedColorCode === stat.code;
          return (
            <button key={stat.code} className={active ? "stat-row active" : "stat-row"} onClick={() => onSelect(active ? null : stat.code)}>
              <span className="color-dot" style={{ background: stat.hex }} />
              <strong>{stat.code}</strong>
              <span>{stat.total} 顆</span>
              <span>剩 {stat.remaining}</span>
              <span>{stat.percent}%</span>
              <span className={lacks ? "danger" : "ok"}>{lacks ? `缺 ${stat.remaining - stock}` : "足夠"}</span>
              <span className="row-actions">
                <em onClick={(e) => { e.stopPropagation(); onBrush(stat.code); }}>設為筆刷</em>
                <em onClick={(e) => { e.stopPropagation(); onCompleteColor(stat.code); }}>標記此色完成</em>
                <em onClick={(e) => { e.stopPropagation(); onClearCompleteColor(stat.code); }}>清除此色完成</em>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
