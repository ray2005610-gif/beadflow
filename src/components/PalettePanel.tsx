import { visiblePalette } from "../data/recognitionPalette";

export function PalettePanel({
  selectedCode,
  recentColors,
  onSelect
}: {
  selectedCode: string;
  recentColors: string[];
  onSelect: (code: string) => void;
}) {
  const groups = Array.from(new Set(visiblePalette.map((color) => color.series ?? color.code[0])));

  return (
    <div className="panel palette-panel">
      <h3>色卡</h3>
      <input
        className="search"
        placeholder="搜尋色號"
        onChange={(event) => {
          const value = event.currentTarget.value.toUpperCase();
          document.querySelectorAll<HTMLElement>("[data-color-code]").forEach((element) => {
            element.style.display = element.dataset.colorCode?.includes(value) ? "" : "none";
          });
        }}
      />
      {recentColors.length > 0 && <ColorStrip title="最近使用" codes={recentColors.slice(0, 12)} selectedCode={selectedCode} onSelect={onSelect} />}
      {groups.map((group) => (
        <section key={group}>
          <h4>{group} 系列</h4>
          <div className="swatches">
            {visiblePalette.filter((color) => (color.series ?? color.code[0]) === group).map((color) => (
              <button
                key={color.code}
                data-color-code={color.code}
                className={selectedCode === color.code ? "swatch active" : "swatch"}
                title={`${color.code} ${color.name}`}
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

function ColorStrip({
  title,
  codes,
  selectedCode,
  onSelect
}: {
  title: string;
  codes: string[];
  selectedCode: string;
  onSelect: (code: string) => void;
}) {
  return (
    <section>
      <h4>{title}</h4>
      <div className="swatches compact">
        {codes.map((code) => {
          const color = visiblePalette.find((item) => item.code === code);
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
