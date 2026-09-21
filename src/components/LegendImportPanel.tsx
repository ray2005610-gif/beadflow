import { useEffect, useMemo, useRef, useState } from "react";
import type { GridCalibration } from "../types/calibration";
import type { LegendEntry, LegendRegion } from "../types/legend";
import { detectLegendRegions, parseLegendText, recognizeLegend } from "../utils/legendRecognition";
import { loadImage } from "../utils/imageToPattern";
import { recordRecognitionStages } from "../utils/recognitionProfile";

export function LegendImportPanel({ imageUrl, calibration, entries, onChange, onBusyChange }: {
  imageUrl: string; calibration: GridCalibration; entries: LegendEntry[];
  onChange: (entries: LegendEntry[]) => void; onBusyChange: (busy: boolean) => void;
}) {
  const regions = useMemo(() => detectLegendRegions(calibration), [calibration]);
  const [region, setRegion] = useState<LegendRegion>(() => regions[0] ?? { x:0,y:0,width:calibration.imageWidth,height:calibration.imageHeight,label:"自訂範圍" });
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => { if (regions[0]) setRegion(regions[0]); }, [regions]);
  useEffect(() => {
    let cancelled = false;
    loadImage(imageUrl).then(image => {
      if (cancelled || !canvas.current) return;
      const target = canvas.current;
      const scale = Math.min(1,400 / image.width);
      target.width = Math.round(image.width * scale); target.height = Math.round(image.height * scale);
      const ctx = target.getContext("2d")!;
      ctx.drawImage(image,0,0,target.width,target.height);
      ctx.strokeStyle = "#b04c32"; ctx.lineWidth = 3;
      ctx.strokeRect(region.x*scale,region.y*scale,region.width*scale,region.height*scale);
    }).catch(() => setMessage("圖片預覽載入失敗"));
    return () => { cancelled = true; };
  }, [imageUrl,region]);
  const read = async () => {
    if (busy) return;
    const id = ++request.current;
    setBusy(true); onBusyChange(true); setMessage(""); setProgress(0);
    const start = performance.now();
    try {
      const result = await recognizeLegend(imageUrl,region,setProgress);
      if (id !== request.current) return;
      onChange(result.entries);
      setText(result.entries.map(e => `${e.colorCode} ${e.expectedCount}`).join("\n"));
      setMessage(result.entries.length ? `讀到 ${result.entries.length} 個色號，請核對色號與顆數後確認。${result.rejected.length ? "部分資料衝突，請手動補正。" : ""}` : "未讀到可靠的色號與顆數，請調整框選範圍或手動貼上。");
    } catch (error) {
      if (id === request.current) setMessage(`色表讀取失敗：${error instanceof Error ? error.message : "請重新嘗試"}。也可手動貼上色號與顆數。`);
    } finally {
      recordRecognitionStages({ legendProcessing: performance.now()-start });
      if (id === request.current) { setBusy(false); onBusyChange(false); }
    }
  };
  return <section className="panel legend-import">
    <h3>原圖色號與顆數</h3>
    <label>色表位置<select disabled={busy} value={region.label} onChange={e => { const r=regions.find(r=>r.label===e.target.value); setRegion(r ?? {...region,label:"自訂範圍"}); }}>
      {regions.map(r=><option key={r.label}>{r.label}</option>)}<option>自訂範圍</option>
    </select></label>
    <canvas ref={canvas} style={{width:"100%",height:"auto"}} aria-label="原圖色表範圍預覽" />
    <div className="grid-fields">
      {(["x","y","width","height"] as const).map((key,i)=><label key={key}>{["左側位置","上方位置","寬度","高度"][i]}
        <input type="number" min={i<2?0:1} max={i%2===0?calibration.imageWidth:calibration.imageHeight} disabled={busy} value={region[key]}
          onChange={e=>setRegion(r=>({...r,label:"自訂範圍",[key]:Math.max(i<2?0:1,Number(e.target.value))}))} />
      </label>)}
    </div>
    <button type="button" onClick={read} disabled={busy}>{busy ? `讀取中 ${Math.round(progress*100)}%` : "讀取框內色號與顆數"}</button>
    <p className="muted-note">首次讀取需下載文字辨識資源。圖片留在瀏覽器處理。</p>
    <label>貼上或補正色號與顆數<textarea rows={4} value={text} disabled={busy} onChange={e=>setText(e.target.value)} placeholder={"B26 161\nB29 145"} /></label>
    <button type="button" disabled={busy || !text.trim()} onClick={()=>{
      const result=parseLegendText(text); onChange(result.entries);
      setMessage(`已匯入 ${result.entries.length} 個有效標準色號。${result.rejected.length ? "已略過：" + result.rejected.join("、") : ""}`);
    }}>套用手動數量表</button>
    {entries.length>0 && <>
      <p>色表合計：{entries.reduce((n,e)=>n+e.expectedCount,0)} 顆</p>
      {entries.map(entry=><label className="checkbox-row" key={entry.colorCode}>
        <input type="checkbox" disabled={busy} checked={entry.confirmed} onChange={e=>onChange(entries.map(item=>item===entry?{...item,confirmed:e.target.checked}:item))} />
        {entry.swatchColor && <span className="swatch" style={{background:entry.swatchColor}} />}
        {entry.colorCode}：{entry.expectedCount} 顆，已核對
      </label>)}
      <div className="toolbar compact-toolbar">
        <button disabled={busy} onClick={()=>onChange(entries.map(e=>({...e,confirmed:true})))}>確認全部數量</button>
        <button disabled={busy} onClick={()=>{onChange([]);setText("");}}>清除數量表</button>
      </div>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
