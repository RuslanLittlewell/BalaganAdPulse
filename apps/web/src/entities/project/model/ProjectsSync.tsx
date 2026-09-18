import { useEffect } from "react";
import { loadProjects, resetProjects } from "./projects.js";

export function ProjectsSync() {
  useEffect(() => {
    void loadProjects();
    return resetProjects;
  }, []);

  return null;
}
