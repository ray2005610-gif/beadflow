import type { PatternProject } from "../types/project";
import { PhotoToPatternPage as PhotoToolPage } from "../components/PhotoToPatternPage";
import { ProjectLibrary } from "../components/ProjectLibrary";

export function PhotoToPatternPage({
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
      <PhotoToolPage onProjectReady={onProjectReady} />
      <main className="workspace narrow">
        <ProjectLibrary projects={projects} onOpen={onOpenProject} onDelete={onDeleteProject} />
      </main>
    </>
  );
}
