import { useEffect, useMemo, useRef, useState } from "react";
import type { GridCalibration } from "../types/calibration";
import type { LegendEntry, LegendRegion } from "../types/legend";
import { detectLegendRegions, parseLegendText, recognizeLegend } from "../utils/legendRecognition";
import { loadImage } from "../utils/imageToPattern";
import { recordRecognitionStages } from "../utils/recognitionProfile";
import { recognitionPalette } from "../data/recognitionPalette";

export function LegendImportPanel({ imageUrl, calibration, entries, onChange, onBusyChange, onConfirmAndRecognize }: {
  imageUrl: string; calibration: GridCalibration; entries: LegendEntry[];
  onChange: (entries: LegendEntry[]) => void; onBusyChange: (busy: boolean) => void;
  onConfirmAndRecognize: (entries: LegendEntry[]) => void;
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
      <div className="legend-edit-list" aria-label="已辨識圖例">
        <div className="legend-edit-head"><span>色塊</span><span>色號</span><span>顆數</span><span>核對</span></div>
        {entries.map((entry,index)=><div className="legend-edit-row" key={`${index}-${entry.colorCode}`}>
          <span className="swatch" style={{background:entry.sampledColor ?? entry.swatchColor ?? recognitionPalette.find(color=>color.code===entry.colorCode)?.hex ?? "#fff"}} />
          <input aria-label={`第 ${index+1} 筆色號`} value={entry.colorCode} disabled={busy}
            onChange={event=>onChange(entries.map((item,itemIndex)=>itemIndex===index?{...item,colorCode:event.target.value.toUpperCase(),confirmed:false}:item))} />
          <input aria-label={`第 ${index+1} 筆顆數`} type="number" min={0} max={14400} value={entry.expectedCount} disabled={busy}
            onChange={event=>onChange(entries.map((item,itemIndex)=>itemIndex===index?{...item,expectedCount:Number(event.target.value),confirmed:false}:item))} />
          <input aria-label={`第 ${index+1} 筆已核對`} type="checkbox" disabled={busy} checked={entry.confirmed}
            onChange={event=>onChange(entries.map((item,itemIndex)=>itemIndex===index?{...item,confirmed:event.target.checked,confidence:event.target.checked?1:item.confidence}:item))} />
          <button type="button" disabled={busy} aria-label={`刪除 ${entry.colorCode || `第 ${index+1} 筆`}`} onClick={()=>onChange(entries.filter((_,itemIndex)=>itemIndex!==index))}>刪除</button>
        </div>)}
      </div>
      <div className="toolbar compact-toolbar">
        <button type="button" disabled={busy} onClick={()=>onChange([...entries,{colorCode:"",expectedCount:0,confidence:1,confirmed:false,source:"manual"}])}>新增色號</button>
        <button className="primary" disabled={busy} onClick={()=>{
          const allowed = new Set(recognitionPalette.map(color=>color.code));
          const normalized = entries.map(entry=>({...entry,colorCode:entry.colorCode.trim().toUpperCase(),expectedCount:Math.round(entry.expectedCount),confirmed:true,confidence:1}));
          const invalid = normalized.find(entry=>!allowed.has(entry.colorCode)||!Number.isSafeInteger(entry.expectedCount)||entry.expectedCount<0||entry.expectedCount>14400);
          const duplicated = normalized.some((entry,index)=>normalized.findIndex(item=>item.colorCode===entry.colorCode)!==index);
          if (invalid || duplicated) {
            setMessage(invalid ? `請修正無效的色號或顆數：${invalid.colorCode || "未填色號"}` : "圖例中有重複色號，請先合併顆數。");
            return;
          }
          onChange(normalized);
          setMessage(`已確認 ${normalized.length} 個圖例色號，辨識結果將只使用這些色號。`);
          onConfirmAndRecognize(normalized);
        }}>確認圖例並開始辨識</button>
        <button disabled={busy} onClick={()=>onChange(entries.map(e=>({...e,confirmed:true,confidence:1})))}>只確認全部</button>
        <button disabled={busy} onClick={()=>{onChange([]);setText("");}}>清除數量表</button>
      </div>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
