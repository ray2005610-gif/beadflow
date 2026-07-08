import { ArrowRight, Grid3X3, Image, Paintbrush } from "lucide-react";
import type { AppPage } from "../types/navigation";
import { BeadHeroModel } from "../components/BeadHeroModel";

const features: Array<{
  page: AppPage;
  title: string;
  description: string;
  icon: typeof Grid3X3;
}> = [
  {
    page: "grid",
    title: "辨識格線圖紙",
    description: "上傳已有格線與色號的拼豆圖紙，快速辨識色號、統計顆數並匯出。",
    icon: Grid3X3
  },
  {
    page: "drawing",
    title: "手動畫圖紙",
    description: "從空白板開始繪製圖紙，支援畫筆、橡皮擦、取色、油漆桶與色號統計。",
    icon: Paintbrush
  },
  {
    page: "photo",
    title: "照片轉拼豆",
    description: "上傳圖片後轉成拼豆圖紙，保留比例並自動對應 MARD 標準色。",
    icon: Image
  }
];

export function HomePage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  return (
    <main className="bf-page home-page">
      <section className="bf-hero">
        <div className="bf-hero-copy">
          <p className="bf-eyebrow">拼豆製作的數位工作台</p>
          <h1>BeadFlow</h1>
          <p className="bf-hero-subtitle">拼豆圖紙辨識、繪製、轉換與庫存管理工具</p>
          <p className="bf-hero-text">
            把圖片、格線圖紙與手繪設計轉成清楚可用的拼豆圖紙，支援色號統計、成本預估、鏡射與匯出。
          </p>
          <div className="bf-hero-actions">
            <button className="bf-button bf-button-primary" type="button" onClick={() => onNavigate("grid")}>
              開始辨識圖紙 <ArrowRight size={18} />
            </button>
            <button className="bf-button bf-button-secondary" type="button" onClick={() => onNavigate("photo")}>
              照片轉拼豆
            </button>
            <button className="bf-button bf-button-ghost" type="button" onClick={() => onNavigate("drawing")}>
              手動畫圖紙
            </button>
          </div>
        </div>
        <BeadHeroModel />
      </section>

      <section className="bf-feature-grid" aria-label="主要功能">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <button key={feature.page} className="bf-feature-card" type="button" onClick={() => onNavigate(feature.page)}>
              <span className="bf-feature-icon"><Icon size={24} /></span>
              <strong>{feature.title}</strong>
              <span>{feature.description}</span>
            </button>
          );
        })}
      </section>
    </main>
  );
}
