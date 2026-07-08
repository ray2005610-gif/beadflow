import type { PatternProject } from "../types/project";
import { DrawingPage } from "../components/DrawingPage";
import { ProjectLibrary } from "../components/ProjectLibrary";

export function ManualPatternPage({
  projects,
  onProjectReady,
  onOpenProject,
  onDeleteProject
}: {
  projects: PatternProject[];
  onProjectReady: (project: PatternProject) => void;
  onOpenProject: (project: PatternProject) => void;
  onDeleteProject: (id: string) => void;
}) {
  return (
    <>
      <DrawingPage onProjectReady={onProjectReady} />
      <main className="workspace narrow">
        <ProjectLibrary projects={projects} onOpen={onOpenProject} onDelete={onDeleteProject} />
      </main>
    </>
  );
}
