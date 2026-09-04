import { Avatar } from "@/shared/ui/index.js";
import type { Project } from "../../api/api.js";

const SIZES = { sm: "size-8", md: "size-10", lg: "size-14" } as const;

export interface ProjectAvatarProps {
  project: Project;
  size?: keyof typeof SIZES;
}

export function ProjectAvatar({ project, size = "md" }: ProjectAvatarProps) {
  if (!project.image) return <Avatar name={project.name} size={size} />;

  return (
    <img
      className={`${SIZES[size]} shrink-0 rounded-md object-cover`}
      src={project.image}
      alt={project.name}
    />
  );
}
