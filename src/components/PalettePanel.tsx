import { mardPalette } from "../data/mardPalette";

export function PalettePanel({
  selectedCode,
  recentColors,
  onSelect
}: {
  selectedCode: string;
  recentColors: string[];
  onSelect: (code: string) => void;
}) {
  const groups = Array.from(new Set(mardPalette.map((c) => c.series ?? c.code[0])));
  return (
    <div className="panel palette-panel">
      <h3>色卡</h3>
      <input className="search" placeholder="搜尋色號" onChange={(e) => {
        const value = e.currentTarget.value.toUpperCase();
        document.querySelectorAll<HTMLElement>("[data-color-code]").forEach((el) => {
          el.style.display = el.dataset.colorCode?.includes(value) ? "" : "none";
        });
      }} />
      {recentColors.length > 0 && <ColorStrip title="最近使用" codes={recentColors} selectedCode={selectedCode} onSelect={onSelect} />}
      {groups.map((group) => (
        <section key={group}>
          <h4>{group} 系列{group === "M" ? "（珠光／特殊色，僅供手動選用）" : ""}</h4>
          <div className="swatches">
            {mardPalette.filter((c) => (c.series ?? c.code[0]) === group).map((color) => (
              <button
                key={color.code}
                data-color-code={color.code}
                className={selectedCode === color.code ? "swatch active" : "swatch"}
                title={`${color.code} ${color.name}${color.series === "M" ? "（珠光特殊色）" : ""}`}
                onClick={() => onSelect(color.code)}
              >
                <span style={{ background: color.hex }} />
                <b>{color.code}</b>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ColorStrip({ title, codes, selectedCode, onSelect }: { title: string; codes: string[]; selectedCode: string; onSelect: (code: string) => void }) {
  return (
    <section>
      <h4>{title}</h4>
      <div className="swatches compact">
        {codes.map((code) => {
          const color = mardPalette.find((c) => c.code === code);
          if (!color) return null;
          return (
            <button key={code} className={selectedCode === code ? "swatch active" : "swatch"} onClick={() => onSelect(code)}>
              <span style={{ background: color.hex }} />
              <b>{code}</b>
            </button>
          );
        })}
      </div>
    </section>
  );
}
