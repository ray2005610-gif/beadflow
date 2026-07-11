export type PatternRenderMode = "grid" | "beads";

export type ViewTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type SelectedCell = {
  row: number;
  col: number;
} | null;

export type BoardConfig = {
  boardWidth: number;
  boardHeight: number;
};

export type BoardTile = {
  id: string;
  row: number;
  col: number;
  index: number;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

export type BoardLayout = {
  boardColumns: number;
  boardRows: number;
  totalBoards: number;
  tiles: BoardTile[];
};
