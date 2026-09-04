import { can } from "@adpulse/access-policy";
import { AppError } from "../../../shared/domain/index.js";
import type { ActorContext } from "../../../shared/application/index.js";
import type { NewProject, ProjectChange, ProjectRecord } from "../domain/project.js";
import type { ProjectDependencies } from "./ports.js";

const VERB = { CREATE: "Created", UPDATE: "Updated", DELETE: "Deleted" } as const;

export function createProjectUseCases(dependencies: ProjectDependencies) {
  const assertCan = (actor: ActorContext, action: "create" | "update" | "delete") => {
    if (!can(actor, action, "project")) {
      throw new AppError("forbidden", `Your role may not ${action} a project`);
    }
  };

  const reach = async (actor: ActorContext, id: string): Promise<ProjectRecord> => {
    const project = await dependencies.projects.findReachable(actor, id);
    if (!project) throw new AppError("not-found", "Project not found");
    return project;
  };

  const assertClientReachable = async (actor: ActorContext, clientId: string) => {
    if (!(await dependencies.clients.isReachable(actor, clientId))) {
      throw new AppError("not-found", "Client not found");
    }
  };

  const withPicture = async (project: ProjectRecord): Promise<ProjectRecord> => {
    if (!project.image) return project;
    const bytes = await dependencies.pictures.read(project.id);
    if (!bytes) return { ...project, image: null };
    return { ...project, image: `data:image/png;base64,${Buffer.from(bytes).toString("base64")}` };
  };

  const audit = (
    action: keyof typeof VERB,
    project: { id: string; clientId: string; name: string },
  ) => ({
    action, entityType: "project", entityId: project.id,
    clientId: project.clientId, projectId: project.id,
    summary: `${VERB[action]} project “${project.name}”`,
  } as const);

  return {
    create: async (actor: ActorContext, input: NewProject): Promise<ProjectRecord> => {
      assertCan(actor, "create");
      await assertClientReachable(actor, input.clientId);
      return dependencies.unitOfWork.run(async (context) => {
        const project = await dependencies.projects.create(context, {
          ...input,
          id: dependencies.ids.generate(),
          position: await dependencies.projects.countForClient(input.clientId),
        });
        await dependencies.audit.append(context, audit("CREATE", project), actor);
        return project;
      });
    },

    list: async (actor: ActorContext, clientId?: string): Promise<ProjectRecord[]> => {
      const projects = await dependencies.projects.listReachable(actor, clientId);
      return Promise.all(projects.map(withPicture));
    },

    read: async (actor: ActorContext, id: string): Promise<ProjectRecord> =>
      withPicture(await reach(actor, id)),

    update: async (actor: ActorContext, id: string, input: ProjectChange): Promise<ProjectRecord> => {
      await reach(actor, id);
      assertCan(actor, "update");
      if (input.clientId) await assertClientReachable(actor, input.clientId);
      const updated = await dependencies.unitOfWork.run(async (context) => {
        const project = await dependencies.projects.update(context, id, input);
        await dependencies.audit.append(context, audit("UPDATE", project), actor);
        return project;
      });
      return withPicture(updated);
    },

    delete: async (actor: ActorContext, id: string): Promise<void> => {
      const project = await reach(actor, id);
      assertCan(actor, "delete");
      await dependencies.unitOfWork.run(async (context) => {
        await dependencies.projects.delete(context, id);
        await dependencies.audit.append(context, audit("DELETE", project), actor);
      });
    },

    savePicture: async (
      actor: ActorContext,
      id: string,
      png: Uint8Array,
      avatarPath: string,
    ): Promise<ProjectRecord> => {
      const project = await reach(actor, id);
      assertCan(actor, "update");
      await dependencies.pictures.write(id, png);
      const updated = await dependencies.unitOfWork.run(async (context) => {
        const saved = await dependencies.projects.update(context, id, {
          image: new Date().toISOString(), avatarPath,
        } as ProjectChange);
        await dependencies.audit.append(context, {
          ...audit("UPDATE", project),
          summary: `Updated picture for project “${project.name}”`,
        }, actor);
        return saved;
      });
      return withPicture(updated);
    },
  };
}

export type ProjectUseCases = ReturnType<typeof createProjectUseCases>;
