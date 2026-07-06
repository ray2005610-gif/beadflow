import { useMemo, useState } from "react";
import { visiblePalette } from "../data/recognitionPalette";
import type { InventoryItem } from "../types/inventory";
import type { ColorStat } from "../types/pattern";
import { buildRestockList } from "../utils/inventoryUtils";

type BatchMode = "replace" | "add";

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
  const [batchQuantity, setBatchQuantity] = useState(1000);
  const [batchScope, setBatchScope] = useState("used");
  const [batchMode, setBatchMode] = useState<BatchMode>("replace");
  const [message, setMessage] = useState("");
  const visibleCodes = useMemo(() => new Set(visiblePalette.map((color) => color.code)), []);
  const usedCodes = useMemo(() => new Set(stats.filter((stat) => visibleCodes.has(stat.code)).map((stat) => stat.code)), [stats, visibleCodes]);
  const filteredPalette = useMemo(
    () => visiblePalette.filter((color) => color.code.includes(query.toUpperCase())),
    [query]
  );
  const list = useMemo(
    () => inventory.filter((item) => visibleCodes.has(item.colorCode) && item.colorCode.includes(query.toUpperCase())),
    [inventory, query, visibleCodes]
  );
  const seriesOptions = useMemo(() => Array.from(new Set(visiblePalette.map((color) => color.series ?? color.code[0]))), []);
  const restock = buildRestockList(stats.filter((stat) => visibleCodes.has(stat.code)), inventory);
  const update = (code: string, patch: Partial<InventoryItem>) => onChange(inventory.map((item) => item.colorCode === code ? { ...item, ...patch } : item));

  const applyBatch = () => {
    const targetColors = getTargetColors(batchScope, usedCodes, filteredPalette);
    if (!targetColors.length) {
      setMessage("沒有符合範圍的顏色");
      return;
    }
    const targetCodes = new Set(targetColors.map((color) => color.code));
    const existingCodes = new Set(inventory.map((item) => item.colorCode));
    const nextInventory = inventory
      .filter((item) => visibleCodes.has(item.colorCode))
      .map((item) => {
        if (!targetCodes.has(item.colorCode)) return item;
        return {
          ...item,
          quantity: batchMode === "replace" ? batchQuantity : item.quantity + batchQuantity
        };
      });
    for (const color of targetColors) {
      if (existingCodes.has(color.code)) continue;
      nextInventory.push({
        colorCode: color.code,
        colorName: color.name,
        hex: color.hex,
        quantity: batchQuantity,
        warningThreshold: 100
      });
    }
    onChange(nextInventory);
    setMessage(`已將 ${targetColors.length} 個顏色${batchMode === "replace" ? "設定為" : "增加"} ${batchQuantity} 顆`);
  };

  const getTargetColors = (scope: string, used: Set<string>, displayed: typeof visiblePalette) => {
    if (scope === "used") return visiblePalette.filter((color) => used.has(color.code));
    if (scope === "displayed") return displayed;
    if (scope === "all") return visiblePalette;
    if (scope.startsWith("series:")) {
      const series = scope.replace("series:", "");
      return visiblePalette.filter((color) => (color.series ?? color.code[0]) === series);
    }
    return [];
  };

  return (
    <div className="panel inventory-panel">
      <h3>庫存管理</h3>
      <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋庫存色號" />
      <div className="batch-stock">
        <h4>批次匯入庫存</h4>
        <div className="grid-fields">
          <label>
            數量
            <input type="number" min={0} value={batchQuantity} onChange={(event) => setBatchQuantity(Math.max(0, Number(event.target.value)))} />
          </label>
          <label>
            套用範圍
            <select value={batchScope} onChange={(event) => setBatchScope(event.target.value)}>
              <option value="used">目前圖紙用到的顏色</option>
              <option value="displayed">目前色卡顯示的顏色</option>
              <option value="all">全部可用顏色</option>
              {seriesOptions.map((series) => (
                <option key={series} value={`series:${series}`}>{series} 系列</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          套用方式
          <select value={batchMode} onChange={(event) => setBatchMode(event.target.value as BatchMode)}>
            <option value="replace">覆蓋成這個數量</option>
            <option value="add">在原本庫存上增加</option>
          </select>
        </label>
        <button className="primary wide" onClick={applyBatch}>批次套用</button>
        {message && <p className="batch-message">{message}</p>}
      </div>
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
