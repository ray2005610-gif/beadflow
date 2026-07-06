import type { PatternProject, PatternStatus } from "../types/project";

export function ProjectDetailPanel({ project, onRename, onStatusChange }: { project: PatternProject; onRename: (name: string) => void; onStatusChange: (status: PatternStatus) => void }) {
  return (
    <div className="panel">
      <h3>圖紙資訊</h3>
      <label>名稱<input value={project.name} onChange={(e) => onRename(e.target.value)} /></label>
      <label>狀態
        <select value={project.status} onChange={(e) => onStatusChange(e.target.value as PatternStatus)}>
          <option value="draft">草稿</option>
          <option value="todo">待做</option>
          <option value="in_progress">製作中</option>
          <option value="done">已完成</option>
          <option value="exported">已匯出</option>
          <option value="stock_out_done">已扣庫存</option>
        </select>
      </label>
      <p>尺寸：{project.size.width}×{project.size.height}</p>
      <p>來源：{sourceLabel(project.sourceType)}</p>
    </div>
  );
}

function sourceLabel(source: PatternProject["sourceType"]) {
  return { grid_recognition: "格線辨識", manual_drawing: "手動畫格", photo_to_pattern: "照片轉拼豆" }[source];
}
