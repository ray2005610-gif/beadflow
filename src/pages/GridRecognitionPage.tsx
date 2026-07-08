import type { PatternProject } from "../types/project";
import { GridImportPage } from "../components/GridImportPage";
import { ProjectLibrary } from "../components/ProjectLibrary";

export function GridRecognitionPage({
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
      <GridImportPage onProjectReady={onProjectReady} />
      <main className="workspace narrow">
        <ProjectLibrary projects={projects} onOpen={onOpenProject} onDelete={onDeleteProject} />
      </main>
    </>
  );
}
