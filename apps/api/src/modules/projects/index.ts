export { createProjectUseCases } from "./application/project-use-cases.js";
export type { ProjectUseCases } from "./application/project-use-cases.js";
export type {
  ClientReach,
  ProjectDependencies,
  ProjectEvents,
  ProjectPictureStorage,
  ProjectRepository,
  ProjectStaffing,
} from "./application/ports.js";
export type { NewProject, ProjectChange, ProjectRecord } from "./domain/project.js";
export { createProjectRouter } from "./presentation/http/project-http.js";
