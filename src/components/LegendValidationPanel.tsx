import { useState } from "react";
import type { ValidationResult } from "../types/legend";
import type { PatternGrid } from "../types/pattern";
import { visiblePalette } from "../data/recognitionPalette";

export function LegendValidationPanel({ result, grid, selectedCode, onSelect, onFocus, onReview, onSafeCorrection }: {
  result: ValidationResult; grid: PatternGrid; selectedCode: string | null;
  onSelect: (code: string | null) => void;
  onFocus: (row: number,col: number) => void;
  onReview: (row:number,col:number,code:string) => void;
  onSafeCorrection: () => void;
}) {
  const [limit,setLimit] = useState(20);
  const suggestions = result.suspiciousCells.filter(s=>!selectedCode || s.from===selectedCode || s.to===selectedCode);
  const mismatched = result.entries.some(e=>e.difference!==0) || result.unexpected.length>0;
  const corrected = grid.flat().filter(c=>c.correctionReason==="legend" || c.correctionReason==="neighbor").length;
  return <div className="legend-validation">
    <p><strong>{result.assignment?.mode === "legend-driven" ? "圖例限制辨識" : "影像辨識"}</strong></p>
    <p>原圖色表合計：{result.expectedTotal} 顆<br/>目前辨識：{result.detectedTotal} 顆<br/>差異：{result.detectedTotal-result.expectedTotal} 顆</p>
    {result.assignment && <p>
      可辨識格數：{result.assignment.detectedValidCells} 格<br/>
      低信心格數：{result.assignment.lowConfidenceCount} 格<br/>
      顆數約束：{result.assignment.constraintApplied ? "已套用" : "未套用"}
    </p>}
    {result.assignment && !result.assignment.totalsMatch && <p className="warning-note" role="status">
      圖例合計與辨識範圍內的有效格數不一致（相差 {Math.abs(result.assignment.difference)} 格），系統沒有強制湊數。請檢查圖例顆數或辨識裁切範圍。
    </p>}
    {corrected>0 && <p>已依色彩證據校正 {corrected} 格。</p>}
    <div className="toolbar compact-toolbar">
      <button disabled={!selectedCode} onClick={()=>onSelect(null)}>清除校驗高亮</button>
      {!result.assignment && <button disabled={!result.suspiciousCells.some(s=>s.safe)} onClick={onSafeCorrection}>套用安全校正</button>}
    </div>
    {result.entries.map(e=><button className={selectedCode===e.colorCode?"wide active":"wide"} key={e.colorCode} onClick={()=>{setLimit(20);onSelect(e.colorCode);}}>
      {e.difference===0 ? "✓ 數量一致" : "需要確認"}　{e.colorCode}<br/>
      原圖 {e.expectedCount}｜辨識 {e.detectedCount}{e.difference ? `｜${e.difference>0?"多":"少"} ${Math.abs(e.difference)}` : ""}
      {!e.confirmed && "（色表尚未核對）"}
    </button>)}
    {result.unexpected.map(e=><p key={e.colorCode}>{e.colorCode}：辨識 {e.detectedCount} 顆，原圖色表未列出</p>)}
    {mismatched && !result.suspiciousCells.length && <p role="status">原圖標示數量與目前辨識結果不一致，暫時無法安全自動修正，請確認。</p>}
    {suggestions.slice(0,limit).map(s=><div className="legend-review-row" style={{borderTop:"1px solid #e3d5c5",padding:"12px 0"}} key={`${s.row}:${s.col}`}>
      <button onClick={()=>onFocus(s.row,s.col)}>定位第 {s.row+1} 列、第 {s.col+1} 欄</button>
      <p>可能由 {s.from} 改為 {s.to}</p>
      <div className="toolbar compact-toolbar">
        <button onClick={()=>onReview(s.row,s.col,s.from)}>確認目前色號</button>
        <button onClick={()=>onReview(s.row,s.col,s.to)}>改成建議色號 {s.to}</button>
      </div>
      <label>選其他 MARD 色號<select value="" onChange={e=>{if(e.target.value)onReview(s.row,s.col,e.target.value);}}>
        <option value="">選擇色號</option>
        {visiblePalette.map(c=><option key={c.code} value={c.code}>{c.code} {c.name}</option>)}
      </select></label>
    </div>)}
    {suggestions.length>limit && <button onClick={()=>setLimit(n=>n+20)}>顯示更多待確認位置</button>}
  </div>;
}
