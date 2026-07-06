import { useMemo, useState } from "react";
import { mardPalette } from "../data/mardPalette";
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
  const list = useMemo(() => inventory.filter((item) => item.colorCode.includes(query.toUpperCase())), [inventory, query]);
  const restock = buildRestockList(stats, inventory);
  const update = (code: string, patch: Partial<InventoryItem>) => onChange(inventory.map((item) => item.colorCode === code ? { ...item, ...patch } : item));
  return (
    <div className="panel inventory-panel">
      <h3>庫存管理</h3>
      <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋庫存色號" />
      <div className="toolbar">
        <button onClick={() => navigator.clipboard.writeText(restock)}>複製補豆清單</button>
        <button onClick={onConsume}>此圖紙扣庫存</button>
      </div>
      <pre className="restock">{restock}</pre>
      <div className="inventory-list">
        {list.map((item) => {
          const color = mardPalette.find((c) => c.code === item.colorCode);
          return (
            <div key={item.colorCode} className="inventory-row">
              <span className="color-dot" style={{ background: color?.hex ?? item.hex }} />
              <strong>{item.colorCode}</strong>
              <input type="number" min={0} value={item.quantity} onChange={(e) => update(item.colorCode, { quantity: Math.max(0, Number(e.target.value)) })} />
              <input type="number" min={0} value={item.warningThreshold} onChange={(e) => update(item.colorCode, { warningThreshold: Math.max(0, Number(e.target.value)) })} />
              <button onClick={() => update(item.colorCode, { quantity: item.quantity + 100 })}>+100</button>
              <button onClick={() => update(item.colorCode, { quantity: Math.max(0, item.quantity - 100) })}>-100</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
