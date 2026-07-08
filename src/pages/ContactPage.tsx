const CONTACT_EMAIL = "beadflow.service@example.com";
const FEEDBACK_FORM_URL = "";

export function ContactPage() {
  return (
    <main className="bf-page">
      <section className="bf-card bf-contact-card">
        <p className="bf-eyebrow">Contact</p>
        <h1>聯絡我們</h1>
        <p>若有問題、功能建議或合作需求，可以透過下方信箱聯絡我們。</p>
        <div className="bf-contact-email">
          <span>聯絡信箱</span>
          <strong>{CONTACT_EMAIL}</strong>
        </div>
        <p className="bf-muted">正式信箱尚未設定，之後會更新為 BeadFlow 專用信箱。</p>
        {FEEDBACK_FORM_URL && (
          <a className="bf-button bf-button-primary" href={FEEDBACK_FORM_URL} target="_blank" rel="noreferrer">
            填寫回饋表單
          </a>
        )}
      </section>
    </main>
  );
}
