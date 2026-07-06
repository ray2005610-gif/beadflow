import type { InventoryItem, InventoryTransaction } from "../types/inventory";
import type { PatternProject } from "../types/project";

const prefix = "beadflow:";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(prefix + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    localStorage.removeItem(prefix + key);
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
  } catch (error) {
    console.error("儲存失敗", error);
  }
}

export const storage = {
  getProjects: () => readJson<PatternProject[]>("projects", []),
  saveProjects: (projects: PatternProject[]) => writeJson("projects", projects),
  getInventory: () => readJson<InventoryItem[]>("inventory", []),
  saveInventory: (inventory: InventoryItem[]) => writeJson("inventory", inventory),
  getTransactions: () => readJson<InventoryTransaction[]>("transactions", []),
  saveTransactions: (items: InventoryTransaction[]) => writeJson("transactions", items),
  getRecentColors: () => readJson<string[]>("recentColors", []),
  saveRecentColors: (items: string[]) => writeJson("recentColors", items),
  getFavoriteColors: () => readJson<string[]>("favoriteColors", []),
  saveFavoriteColors: (items: string[]) => writeJson("favoriteColors", items),
  getDisplaySettings: () => readJson("displaySettings", { showGrid: true, showSymbols: false, showCoordinates: true }),
  saveDisplaySettings: (settings: unknown) => writeJson("displaySettings", settings)
};
