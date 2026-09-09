import { AppError } from "#shared/domain/index.js";
import type { ActorContext, IdGenerator, UnitOfWork } from "#shared/application/index.js";
import { arrange, asInput, reconcile } from "../domain/layout.js";
import type { GroupRecord, LayoutInput, ProjectLayout } from "../domain/layout.js";
import type { ProjectLayoutRepository, ProjectReach } from "./ports.js";

export interface ProjectLayoutDependencies {
  readonly layouts: ProjectLayoutRepository;
  readonly projects: ProjectReach;
  readonly ids: IdGenerator;
  readonly unitOfWork: UnitOfWork;
}

const namedProjects = (input: LayoutInput): readonly string[] => [
  ...input.pinned,
  ...input.items.flatMap((item) => (item.type === "project" ? [item.projectId] : item.projectIds)),
];

export function createProjectLayoutUseCases(dependencies: ProjectLayoutDependencies) {
  const seen = async (actor: ActorContext) => {
    const [reachable, stored] = await Promise.all([
      dependencies.projects.reachableIds(actor),
      dependencies.layouts.read(actor.membershipId),
    ]);
    return { stored, layout: reconcile(reachable, stored), reachable: new Set(reachable) };
  };

  const read = async (actor: ActorContext): Promise<ProjectLayout> => (await seen(actor)).layout;

  return {
    read,

    replace: async (actor: ActorContext, input: LayoutInput): Promise<ProjectLayout> => {
      const { stored, reachable } = await seen(actor);
      const projects = namedProjects(input);
      if (new Set(projects).size !== projects.length) {
        throw new AppError("validation", "A project may hold only one place in the list");
      }
      if (projects.some((projectId) => !reachable.has(projectId))) {
        throw new AppError("not-found", "Project not found");
      }
      const own = new Set(stored.groups.map((group) => group.id));
      if (input.items.some((item) => item.type === "group" && !own.has(item.groupId))) {
        throw new AppError("not-found", "Group not found");
      }
      await dependencies.unitOfWork.run((context) => dependencies.layouts.replace(
        context, actor.membershipId, arrange(input, stored.groups),
      ));
      return read(actor);
    },

    createGroup: async (actor: ActorContext, name: string): Promise<GroupRecord> => {
      const named = name.trim();
      if (named === "") throw new AppError("validation", "A group needs a name");
      const { stored, layout } = await seen(actor);
      return dependencies.unitOfWork.run(async (context) => {
        await dependencies.layouts.replace(
          context, actor.membershipId, arrange(asInput(layout), stored.groups),
        );
        return dependencies.layouts.createGroup(context, {
          id: dependencies.ids.generate(),
          membershipId: actor.membershipId,
          name: named,
          position: layout.items.length,
        });
      });
    },

    deleteGroup: async (actor: ActorContext, groupId: string): Promise<void> => {
      const stored = await dependencies.layouts.read(actor.membershipId);
      if (!stored.groups.some((group) => group.id === groupId)) {
        throw new AppError("not-found", "Group not found");
      }
      if (stored.placements.some((placement) => placement.groupId === groupId)) {
        throw new AppError("conflict", "Only an empty group may be deleted");
      }
      await dependencies.unitOfWork.run(
        (context) => dependencies.layouts.deleteGroup(context, actor.membershipId, groupId),
      );
    },
  };
}

export type ProjectLayoutUseCases = ReturnType<typeof createProjectLayoutUseCases>;
