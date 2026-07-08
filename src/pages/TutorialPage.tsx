import { useEffect, useState } from "react";
import { X } from "lucide-react";

const tutorialImages = [
  {
    title: "辨識格線圖紙教學",
    src: "/tutorials/grid-recognition-guide.png"
  },
  {
    title: "手動畫圖紙教學",
    src: "/tutorials/manual-drawing-guide.png"
  },
  {
    title: "照片轉拼豆教學",
    src: "/tutorials/photo-to-pattern-guide.png"
  }
];

const faqItems = [
  {
    question: "自動辨識會使用特殊色嗎？",
    answer: "不會。BeadFlow 自動辨識預設只使用 MARD A～M 標準色。特殊色可以在手動畫圖紙或手動替代顏色時使用。"
  },
  {
    question: "透明格會算進成本嗎？",
    answer: "不會。透明格、空白格與留白不會計入色號統計、庫存需求與成本預估。"
  },
  {
    question: "匯出的圖紙可以列印嗎？",
    answer: "可以。匯出的完整圖紙 PNG 會包含格線、座標、色號、色表與顆數，適合儲存、分享或列印參考。"
  }
];

export function TutorialPage() {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<(typeof tutorialImages)[number] | null>(null);

  useEffect(() => {
    if (!previewImage) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewImage(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewImage]);

  return (
    <main className="bf-page">
      <section className="bf-card bf-intro-card">
        <p className="bf-eyebrow">Guide</p>
        <h1>使用教學</h1>
        <p>這裡會整理 BeadFlow 的操作教學，包含辨識格線圖紙、照片轉拼豆與手動畫圖紙。之後可以點開對應教學圖片，快速了解每個功能的使用方式。</p>
      </section>
      <section className="bf-tutorial-grid">
        {tutorialImages.map((item) => (
          <article className="bf-card bf-tutorial-card" key={item.src}>
            <h2>{item.title}</h2>
            {failedImages[item.src] ? (
              <div className="bf-tutorial-image-fallback">教學圖片準備中</div>
            ) : (
              <button
                className="bf-tutorial-image-button"
                type="button"
                onClick={() => setPreviewImage(item)}
                aria-label={`放大檢視${item.title}`}
              >
                <img
                  className="bf-tutorial-image"
                  src={item.src}
                  alt={item.title}
                  onError={() => setFailedImages((current) => ({ ...current, [item.src]: true }))}
                />
              </button>
            )}
          </article>
        ))}
      </section>
      <section className="bf-card bf-faq-card">
        <p className="bf-eyebrow">FAQ</p>
        <h2>常見問題</h2>
        <div className="bf-faq-list">
          {faqItems.map((item) => (
            <details className="bf-faq-item" key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
      {previewImage && (
        <div className="bf-lightbox" role="dialog" aria-modal="true" aria-label={previewImage.title} onClick={() => setPreviewImage(null)}>
          <div className="bf-lightbox-content" onClick={(event) => event.stopPropagation()}>
            <div className="bf-lightbox-header">
              <h2>{previewImage.title}</h2>
              <button className="bf-icon-button" type="button" onClick={() => setPreviewImage(null)} aria-label="關閉圖片">
                <X size={22} />
              </button>
            </div>
            <img src={previewImage.src} alt={previewImage.title} />
          </div>
        </div>
      )}
    </main>
  );
}
