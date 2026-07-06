import { useMemo, useState } from "react";
import { visiblePalette } from "../data/recognitionPalette";
import type { InventoryItem } from "../types/inventory";
import type { ColorStat } from "../types/pattern";
import { buildRestockList } from "../utils/inventoryUtils";

export function InventoryPanel({
  inventory,
  stats,
  onChange,
  onConsume
}: {
  inventory: InventoryItem[];
  stats: ColorStat[];
  onChange: (items: InventoryItem[]) => void;
  onConsume: () => void;
}) {
  const [query, setQuery] = useState("");
  const visibleCodes = useMemo(() => new Set(visiblePalette.map((color) => color.code)), []);
  const list = useMemo(
    () => inventory.filter((item) => visibleCodes.has(item.colorCode) && item.colorCode.includes(query.toUpperCase())),
    [inventory, query, visibleCodes]
  );
  const restock = buildRestockList(stats.filter((stat) => visibleCodes.has(stat.code)), inventory);
  const update = (code: string, patch: Partial<InventoryItem>) => onChange(inventory.map((item) => item.colorCode === code ? { ...item, ...patch } : item));

  return (
    <div className="panel inventory-panel">
      <h3>庫存管理</h3>
      <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋庫存色號" />
      <div className="toolbar">
        <button onClick={() => navigator.clipboard.writeText(restock)}>複製補豆清單</button>
        <button onClick={onConsume}>此圖紙扣庫存</button>
      </div>
      <pre className="restock">{restock}</pre>
      <div className="inventory-list">
        {list.map((item) => {
          const color = visiblePalette.find((candidate) => candidate.code === item.colorCode);
          return (
            <div key={item.colorCode} className="inventory-row">
              <span className="color-dot" style={{ background: color?.hex ?? item.hex }} />
              <strong>{item.colorCode}</strong>
              <input type="number" min={0} value={item.quantity} onChange={(event) => update(item.colorCode, { quantity: Math.max(0, Number(event.target.value)) })} />
              <input type="number" min={0} value={item.warningThreshold} onChange={(event) => update(item.colorCode, { warningThreshold: Math.max(0, Number(event.target.value)) })} />
              <button onClick={() => update(item.colorCode, { quantity: item.quantity + 100 })}>+100</button>
              <button onClick={() => update(item.colorCode, { quantity: Math.max(0, item.quantity - 100) })}>-100</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
