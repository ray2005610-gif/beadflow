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

export function TutorialPage() {
  return (
    <main className="bf-page">
      <section className="bf-card bf-intro-card">
        <p className="bf-eyebrow">Guide</p>
        <h1>使用教學</h1>
        <p>這裡會放置 BeadFlow 的圖文教學。之後把教學圖片放進 public/tutorials/ 後，就可以在這裡呈現。</p>
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
    </main>
  );
}
