const tutorialImages = [
  {
    title: "辨識格線圖紙教學",
    src: "/tutorials/grid-recognition.png"
  },
  {
    title: "照片轉拼豆教學",
    src: "/tutorials/photo-to-pattern.png"
  },
  {
    title: "手動畫圖紙教學",
    src: "/tutorials/manual-drawing.png"
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
            <div className="bf-tutorial-placeholder">
              <img src={item.src} alt={item.title} onError={(event) => { event.currentTarget.style.display = "none"; }} />
              <span>教學圖片準備中</span>
            </div>
            <h2>{item.title}</h2>
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
    </main>
  );
}
