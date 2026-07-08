import { visiblePalette } from "../data/recognitionPalette";
import type { BeadColor } from "../types/bead";

const text = {
  title: "\u8272\u5361",
  search: "\u641c\u5c0b\u8272\u865f",
  recent: "\u6700\u8fd1\u4f7f\u7528",
  series: "\u7cfb\u5217",
  manualOnly: "\u624b\u52d5\u9078\u8272\u7528",
  pearl: "\u73e0\u5149",
  transparent: "\u900f\u660e",
  neon: "\u87a2\u5149",
  special: "\u7279\u6b8a"
};

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
      <h3>{text.title}</h3>
      <input
        className="search"
        placeholder={text.search}
        onChange={(event) => {
          const value = event.currentTarget.value.toUpperCase();
          document.querySelectorAll<HTMLElement>("[data-color-code]").forEach((element) => {
            element.style.display = element.dataset.colorCode?.includes(value) ? "" : "none";
          });
        }}
      />
      {recentColors.length > 0 && <ColorStrip title={text.recent} codes={recentColors.slice(0, 12)} selectedCode={selectedCode} onSelect={onSelect} />}
      {groups.map((group) => (
        <section key={group}>
          <h4>{group} {text.series}</h4>
          <div className="swatches">
            {visiblePalette.filter((color) => (color.series ?? color.code[0]) === group).map((color) => (
              <SwatchButton
                key={color.code}
                color={color}
                active={selectedCode === color.code}
                onSelect={onSelect}
              />
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
          return <SwatchButton key={code} color={color} active={selectedCode === code} onSelect={onSelect} compact />;
        })}
      </div>
    </section>
  );
}

function SwatchButton({
  color,
  active,
  compact = false,
  onSelect
}: {
  color: BeadColor;
  active: boolean;
  compact?: boolean;
  onSelect: (code: string) => void;
}) {
  const label = color.specialLabel ?? specialLabelForColor(color);
  return (
    <button
      data-color-code={color.code}
      className={["swatch", active ? "active" : "", label ? "special" : "", compact ? "compact-swatch" : ""].filter(Boolean).join(" ")}
      title={color.code + " " + color.name + (label ? " (" + label + ", " + text.manualOnly + ")" : "")}
      onClick={() => onSelect(color.code)}
    >
      <span style={{ background: color.hex }} />
      <b>{color.code}</b>
      {label && <em>{label}</em>}
    </button>
  );
}

function specialLabelForColor(color: BeadColor) {
  if (color.isPearl) return text.pearl;
  if (color.isTransparent) return text.transparent;
  if (color.isNeon) return text.neon;
  if (color.isSpecial) return text.special;
  return "";
}
