export type AppPage =
  | "home"
  | "grid"
  | "drawing"
  | "photo"
  | "tutorial"
  | "contact";

export type NavItem = {
  id: AppPage;
  label: string;
};

export const navItems: NavItem[] = [
  { id: "home", label: "首頁" },
  { id: "grid", label: "辨識格線圖紙" },
  { id: "drawing", label: "手動畫圖紙" },
  { id: "photo", label: "照片轉拼豆" },
  { id: "tutorial", label: "使用教學" },
  { id: "contact", label: "聯絡我們" }
];
