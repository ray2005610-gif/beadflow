import type { GridCalibration } from "../types/calibration";
import type { LegendEntry, LegendRegion } from "../types/legend";
import { recognitionPalette } from "../data/recognitionPalette";
import { loadImage } from "./imageToPattern";
import { deltaE2000, hexToRgb, rgbToHex, rgbToLab } from "./colorUtils";

const allowed = new Map(recognitionPalette.map(c => [c.code, c]));
export function detectLegendRegions(c: GridCalibration): LegendRegion[] {
  const crop = c.cropRange ?? { startCol: 0, endCol: c.columns - 1, startRow: 0, endRow: c.rows - 1 };
  const x = Math.max(0, c.originX + crop.startCol * c.cellWidth);
  const y = Math.max(0, c.originY + crop.startRow * c.cellHeight);
  const right = Math.min(c.imageWidth, c.originX + (crop.endCol + 1) * c.cellWidth);
  const bottom = Math.min(c.imageHeight, c.originY + (crop.endRow + 1) * c.cellHeight);
  return [
    { label: "下方色表", x: 0, y: bottom, width: c.imageWidth, height: c.imageHeight - bottom },
    { label: "右側色表", x: right, y: 0, width: c.imageWidth - right, height: c.imageHeight },
    { label: "左側色表", x: 0, y: 0, width: x, height: c.imageHeight },
    { label: "上方色表", x: 0, y: 0, width: c.imageWidth, height: y }
  ].filter(r => r.width >= 12 && r.height >= 12);
}

export function parseLegendText(text: string, source: LegendEntry["source"] = "manual", confidence = 1) {
  const entries = new Map<string, LegendEntry>();
  const rejected: string[] = [];
  const conflicts = new Set<string>();
  // Counts must be explicit integers following an exact legal code; no O/0 guessing.
  const pattern = /\b([A-Z]{1,3}\d{1,3})(?:\s+|\s*[:=：,，×x]\s*)(\d+(?:,\d{3})*)(?![\d.,])(?:\s*(?:顆|pcs))?(?=\s|$|[;；])/gi;
  for (const match of text.matchAll(pattern)) {
    const colorCode = match[1].toUpperCase();
    const expectedCount = Number(match[2].replace(/,/g, ""));
    if (!allowed.has(colorCode) || !Number.isSafeInteger(expectedCount) || expectedCount < 0 || expectedCount > 14400) {
      rejected.push(match[0]); continue;
    }
    if (entries.has(colorCode) && entries.get(colorCode)!.expectedCount !== expectedCount) {
      conflicts.add(colorCode); rejected.push(`${colorCode} 數量重複且不一致`); continue;
    }
    entries.set(colorCode, { colorCode, expectedCount, confidence, confirmed: source === "manual", source });
  }
  for (const code of conflicts) entries.delete(code);
  return { entries: [...entries.values()], rejected };
}

type Word = { text: string; confidence: number; bbox: { x0: number; x1: number; y0: number; y1: number } };
export function parseLegendWords(words: Word[]) {
  const lines: string[] = [];
  const used = new Set<Word>();
  const entries: LegendEntry[] = [];
  for (const word of words) {
    const code = word.text.trim().toUpperCase();
    if (!allowed.has(code)) continue;
    const h = Math.max(1, word.bbox.y1 - word.bbox.y0);
    const centerX = (word.bbox.x0 + word.bbox.x1) / 2;
    const choices = words.filter(n => !used.has(n) && /^\d[\d,]*$/.test(n.text.trim())).map(n => {
      const sameRow = Math.abs((n.bbox.y0 + n.bbox.y1 - word.bbox.y0 - word.bbox.y1) / 2) < h * 0.6;
      const dx = n.bbox.x0 - word.bbox.x1;
      const below = n.bbox.y0 - word.bbox.y1;
      const aligned = Math.abs((n.bbox.x0 + n.bbox.x1) / 2 - centerX) < h * 1.8;
      const score = sameRow && dx >= -2 && dx < h * 5 ? dx : aligned && below >= -2 && below < h * 2.5 ? below + h : Infinity;
      return { word: n, score };
    }).filter(n => Number.isFinite(n.score)).sort((a,b) => a.score - b.score);
    const count = choices[0]?.word;
    if (!count) continue;
    used.add(count);
    const parsed = parseLegendText(`${code} ${count.text}`, "ocr", Math.min(word.confidence, count.confidence) / 100);
    entries.push(...parsed.entries);
    lines.push(`${code} ${count.text}`);
  }
  // Reuse duplicate/conflict checks across OCR rows and columns.
  const parsed = parseLegendText(lines.join("\n"), "ocr");
  return { entries: parsed.entries.map(e => ({ ...e, confidence: Math.min(...entries.filter(x => x.colorCode === e.colorCode).map(x => x.confidence)) })), rejected: parsed.rejected };
}

export async function recognizeLegend(imageUrl: string, region: LegendRegion, onProgress: (value: number) => void) {
  const image = await loadImage(imageUrl);
  const x = Math.max(0, Math.min(image.naturalWidth - 1, region.x));
  const y = Math.max(0, Math.min(image.naturalHeight - 1, region.y));
  const width = Math.max(1, Math.min(region.width, image.naturalWidth - x));
  const height = Math.max(1, Math.min(region.height, image.naturalHeight - y));
  const scale = Math.min(3, 2400 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,x,y,width,height,0,0,canvas.width,canvas.height);
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: message => { if (message.status === "recognizing text") onProgress(message.progress); }
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: "1", user_defined_dpi: "300" });
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
    const words = (data.blocks ?? []).flatMap(b => b.paragraphs.flatMap(p => p.lines.flatMap(l => l.words)));
    const parsed = parseLegendWords(words);
    const pixels = ctx.getImageData(0,0,canvas.width,canvas.height);
    for (const entry of parsed.entries) {
      const word = words.find(w => w.text.trim().toUpperCase() === entry.colorCode);
      if (!word) continue;
      const h = word.bbox.y1 - word.bbox.y0;
      const groups = new Map<string, { count: number; r: number; g: number; b: number }>();
      // Optional colored swatch immediately left of a code; absence is not a failure.
      for (let py = Math.max(0,word.bbox.y0); py < Math.min(canvas.height,word.bbox.y1); py++) {
        for (let px = Math.max(0,word.bbox.x0 - h * 2); px < word.bbox.x0; px++) {
          const i = (py * canvas.width + Math.floor(px)) * 4;
          const [r,g,b] = pixels.data.slice(i,i+3);
          if (Math.max(r,g,b) - Math.min(r,g,b) < 18) continue;
          const key = `${r >> 4},${g >> 4},${b >> 4}`;
          const group = groups.get(key) ?? { count:0,r:0,g:0,b:0 };
          group.count++; group.r+=r; group.g+=g; group.b+=b; groups.set(key,group);
        }
      }
      const group = [...groups.values()].sort((a,b) => b.count-a.count)[0];
      if (group && group.count > h * h * 0.15) {
        const rgb = { r: group.r/group.count, g: group.g/group.count, b: group.b/group.count };
        entry.swatchColor = rgbToHex(rgb);
        if (deltaE2000(rgbToLab(rgb),rgbToLab(hexToRgb(allowed.get(entry.colorCode)!.hex))) > 18) entry.confidence = Math.min(entry.confidence,0.5);
      }
    }
    return { ...parsed, text: data.text };
  } finally { await worker.terminate(); }
}
