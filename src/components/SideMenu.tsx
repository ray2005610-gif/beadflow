import { X } from "lucide-react";
import type { AppPage } from "../types/navigation";
import { navItems } from "../types/navigation";

export function SideMenu({
  open,
  activePage,
  onClose,
  onNavigate
}: {
  open: boolean;
  activePage: AppPage;
  onClose: () => void;
  onNavigate: (page: AppPage) => void;
}) {
  const navigate = (page: AppPage) => {
    onNavigate(page);
    onClose();
  };

  return (
    <>
      <div className={open ? "bf-menu-backdrop visible" : "bf-menu-backdrop"} onClick={onClose} aria-hidden="true" />
      <aside className={open ? "bf-side-menu open" : "bf-side-menu"} aria-hidden={!open}>
        <div className="bf-side-menu-head">
          <div>
            <strong>BeadFlow</strong>
            <span>工作選單</span>
          </div>
          <button className="bf-icon-button" type="button" onClick={onClose} aria-label="關閉選單">
            <X size={20} />
          </button>
        </div>
        <nav className="bf-side-menu-list" aria-label="側邊選單">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={activePage === item.id ? "active" : ""}
              type="button"
              onClick={() => navigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
