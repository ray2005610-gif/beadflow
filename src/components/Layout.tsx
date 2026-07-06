import type { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>BeadFlow</h1>
          <p>拼豆圖紙辨識、繪製、製作輔助與庫存管理</p>
        </div>
        <span className="version-badge">測試版本 2026-07-06 09:19</span>
      </header>
      {children}
    </div>
  );
}
