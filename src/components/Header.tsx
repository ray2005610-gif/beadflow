import { Menu } from "lucide-react";
import type { AppPage } from "../types/navigation";
import { navItems } from "../types/navigation";

export const APP_VERSION_TEXT = "版本 2026-07-24 19:20";

export function Header({
  activePage,
  onMenuClick,
  onNavigate
}: {
  activePage: AppPage;
  onMenuClick: () => void;
  onNavigate: (page: AppPage) => void;
}) {
  return (
    <header className="bf-header">
      <div className="bf-header-brand">
        <button className="bf-menu-button" type="button" onClick={onMenuClick} aria-label="開啟選單">
          <Menu size={22} />
        </button>
        <button className="bf-brand-button" type="button" onClick={() => onNavigate("home")}>
          <span className="bf-brand-title">BeadFlow</span>
          <span className="bf-brand-subtitle">拼豆圖紙辨識、繪製、製作輔助與庫存管理</span>
        </button>
      </div>
      <nav className="bf-desktop-nav" aria-label="主選單">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={activePage === item.id ? "active" : ""}
            type="button"
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <span className="version-badge">{APP_VERSION_TEXT}</span>
    </header>
  );
}
