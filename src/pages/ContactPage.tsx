const FEEDBACK_FORM_URL = "https://forms.gle/ieeFrHotrBBh5cxd7";

export function ContactPage() {
  return (
    <main className="bf-page">
      <section className="bf-card bf-contact-card">
        <p className="bf-eyebrow">Contact</p>
        <h1>聯絡我們</h1>
        <p>如果你在使用 BeadFlow 時遇到問題、想建議新功能，或有合作需求，歡迎透過意見回饋表單告訴我們。</p>
        <div className="bf-feedback-box">
          <span>意見回饋表單</span>
          <p>功能建議、錯誤回報、辨識問題與合作需求都可以透過表單提交。</p>
          {FEEDBACK_FORM_URL ? (
            <a className="bf-button bf-button-primary" href={FEEDBACK_FORM_URL} target="_blank" rel="noreferrer">
              填寫意見回饋表單
            </a>
          ) : (
            <p className="bf-muted">意見回饋表單準備中</p>
          )}
        </div>
      </section>
    </main>
  );
}
