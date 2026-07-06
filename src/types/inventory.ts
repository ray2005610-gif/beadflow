export type InventoryItem = {
  colorCode: string;
  colorName: string;
  hex: string;
  quantity: number;
  warningThreshold: number;
};

export type InventoryTransactionType =
  | "stock_in"
  | "stock_out"
  | "manual_adjust"
  | "pattern_consume";

export type InventoryTransaction = {
  id: string;
  type: InventoryTransactionType;
  colorCode: string;
  colorName: string;
  quantityChange: number;
  beforeQuantity: number;
  afterQuantity: number;
  note?: string;
  createdAt: string;
};
