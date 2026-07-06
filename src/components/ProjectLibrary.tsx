import type { PatternProject } from "../types/project";
import { calculateColorStats, completePercent, totalCells } from "../utils/patternStats";

export function ProjectLibrary({ projects, onOpen, onDelete }: { projects: PatternProject[]; onOpen: (project: PatternProject) => void; onDelete: (id: string) => void }) {
  return (
    <div className="panel library-panel">
      <h3>圖紙冊</h3>
      {projects.length === 0 && <p>尚未儲存圖紙</p>}
      <div className="project-list">
        {projects.map((project) => (
          <div key={project.id} className="project-card">
            <strong>{project.name}</strong>
            <span>{project.size.width}×{project.size.height} / {calculateColorStats(project.grid).length} 色 / {totalCells(project.grid)} 顆</span>
            <span>完成 {completePercent(project.grid)}% / {project.status}</span>
            <div className="toolbar">
              <button onClick={() => onOpen(project)}>打開</button>
              <button onClick={() => onDelete(project.id)}>刪除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
