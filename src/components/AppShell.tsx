import { useState, type ReactNode } from "react";
import type { AppPage } from "../types/navigation";
import { Header } from "./Header";
import { SideMenu } from "./SideMenu";

export function AppShell({
  activePage,
  onNavigate,
  children
}: {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bf-app-shell">
      <Header activePage={activePage} onMenuClick={() => setMenuOpen(true)} onNavigate={onNavigate} />
      <SideMenu open={menuOpen} activePage={activePage} onClose={() => setMenuOpen(false)} onNavigate={onNavigate} />
      {children}
    </div>
  );
}
