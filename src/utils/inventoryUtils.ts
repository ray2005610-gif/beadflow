import type { InventoryItem, InventoryTransaction } from "../types/inventory";
import type { ColorStat } from "../types/pattern";

export function buildRestockList(stats: ColorStat[], inventory: InventoryItem[]): string {
  const lines = ["補豆清單"];
  for (const stat of stats) {
    const stock = inventory.find((item) => item.colorCode === stat.code)?.quantity ?? 0;
    if (stock < stat.remaining) lines.push(`${stat.code}：缺 ${stat.remaining - stock} 顆`);
  }
  return lines.length === 1 ? "補豆清單\n目前庫存足夠" : lines.join("\n");
}

export function consumeInventory(stats: ColorStat[], inventory: InventoryItem[]): { inventory: InventoryItem[]; transactions: InventoryTransaction[] } {
  const now = new Date().toISOString();
  const transactions: InventoryTransaction[] = [];
  const next = inventory.map((item) => {
    const stat = stats.find((entry) => entry.code === item.colorCode);
    if (!stat || stat.remaining === 0) return item;
    const after = Math.max(0, item.quantity - stat.remaining);
    transactions.push({
      id: crypto.randomUUID(),
      type: "pattern_consume",
      colorCode: item.colorCode,
      colorName: item.colorName,
      quantityChange: after - item.quantity,
      beforeQuantity: item.quantity,
      afterQuantity: after,
      note: "圖紙扣庫存",
      createdAt: now
    });
    return { ...item, quantity: after };
  });
  return { inventory: next, transactions };
}
