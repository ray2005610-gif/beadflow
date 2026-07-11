import type { BoardConfig, BoardLayout, BoardTile, ViewTransform } from "../types/craft";

export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  boardWidth: 52,
  boardHeight: 52
};

export function createBoardLayout(patternWidth: number, patternHeight: number, config: BoardConfig = DEFAULT_BOARD_CONFIG): BoardLayout {
  const boardColumns = Math.max(1, Math.ceil(patternWidth / config.boardWidth));
  const boardRows = Math.max(1, Math.ceil(patternHeight / config.boardHeight));
  const tiles: BoardTile[] = [];
  for (let row = 0; row < boardRows; row += 1) {
    for (let col = 0; col < boardColumns; col += 1) {
      const index = row * boardColumns + col + 1;
      tiles.push({
        id: boardId(row, col),
        row,
        col,
        index,
        startRow: row * config.boardHeight,
        endRow: Math.min(patternHeight, (row + 1) * config.boardHeight),
        startCol: col * config.boardWidth,
        endCol: Math.min(patternWidth, (col + 1) * config.boardWidth)
      });
    }
  }
  return {
    boardColumns,
    boardRows,
    totalBoards: tiles.length,
    tiles
  };
}

export function boardId(row: number, col: number): string {
  return `board-${row}-${col}`;
}

export function tileForCell(row: number, col: number, layout: BoardLayout): BoardTile | null {
  return layout.tiles.find((tile) => row >= tile.startRow && row < tile.endRow && col >= tile.startCol && col < tile.endCol) ?? null;
}

export function clampViewTransform(transform: ViewTransform, viewportWidth: number, viewportHeight: number, contentWidth: number, contentHeight: number): ViewTransform {
  const minX = Math.min(24, viewportWidth - contentWidth - 24);
  const minY = Math.min(24, viewportHeight - contentHeight - 24);
  return {
    scale: transform.scale,
    offsetX: clamp(transform.offsetX, minX, viewportWidth - 24),
    offsetY: clamp(transform.offsetY, minY, viewportHeight - 24)
  };
}

export function screenToGridPoint(screenX: number, screenY: number, transform: ViewTransform, cellSize: number) {
  return {
    col: Math.floor((screenX - transform.offsetX) / (cellSize * transform.scale)),
    row: Math.floor((screenY - transform.offsetY) / (cellSize * transform.scale))
  };
}

export function gridToScreenPoint(row: number, col: number, transform: ViewTransform, cellSize: number) {
  return {
    x: transform.offsetX + col * cellSize * transform.scale,
    y: transform.offsetY + row * cellSize * transform.scale
  };
}

export function getVisibleGridRange(viewportWidth: number, viewportHeight: number, transform: ViewTransform, cellSize: number, rows: number, cols: number) {
  const start = screenToGridPoint(0, 0, transform, cellSize);
  const end = screenToGridPoint(viewportWidth, viewportHeight, transform, cellSize);
  return {
    startRow: clamp(start.row - 1, 0, rows - 1),
    endRow: clamp(end.row + 2, 0, rows),
    startCol: clamp(start.col - 1, 0, cols - 1),
    endCol: clamp(end.col + 2, 0, cols)
  };
}

export function storageKeyForCraft(projectId: string): string {
  return `beadflow:craft:${projectId}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
