import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { AppError } from "#shared/domain/index.js";
import type { LeadUseCases } from "#modules/leads/application/lead-use-cases.js";
import type { LeadFileUseCases } from "#modules/leads/application/lead-file-use-cases.js";
import type { LeadNoteUseCases } from "#modules/leads/application/lead-note-use-cases.js";
import type { LeadFieldUseCases } from "#modules/leads/application/lead-field-use-cases.js";
import type { CrmRecordUseCases } from "#modules/leads/application/crm-record-use-cases.js";
import type { ConversionEventUseCases } from "#modules/leads/application/conversion-event-use-cases.js";
import { leadFileUpload, uploadedName } from "./lead-file-upload.js";
import {
  createLeadSchema,
  updateLeadSchema,
  moveLeadSchema,
  createColumnSchema,
  updateColumnSchema,
  createFieldSchema,
  updateFieldSchema,
  createCompanySchema,
  updateCompanySchema,
  createPersonSchema,
  updatePersonSchema,
  stageCountsQuerySchema,
  leadNoteSchema,
  createConversionEventSchema,
  updateConversionEventSchema,
  normalize,
} from "./lead-schemas.js";
export function createLeadRouter(leads: LeadUseCases, files: LeadFileUseCases, fields: LeadFieldUseCases, records: CrmRecordUseCases, notes: LeadNoteUseCases, events: ConversionEventUseCases) {
  const router = Router();
  const handle =
    (
      fn: (
        req: Request<{ boardKey: string; id: string; fileId: string; clientId: string; noteId: string }>,
        res: Response,
      ) => Promise<unknown>,
    ) =>
    (
      req: Request<{ boardKey: string; id: string; fileId: string; clientId: string; noteId: string }>,
      res: Response,
      next: NextFunction,
    ) => {
      void fn(req, res).catch(next);
    };
  const actor = (req: Request) => {
    if (!req.actor)
      throw new AppError("unauthorized", "Authentication required");
    return req.actor;
  };
  router.get(
    "/project-stage-counts",
    handle(async (req, res) =>
      res.json(
        await leads.projectStageCounts(
          actor(req),
          stageCountsQuerySchema.parse(req.query),
        ),
      ),
    ),
  );
  router.get(
    "/boards",
    handle(async (req, res) => res.json(await leads.boards(actor(req)))),
  );
  router.get(
    "/boards/:boardKey/stage-counts",
    handle(async (req, res) =>
      res.json(
        await leads.boardStageCounts(
          actor(req),
          req.params.boardKey,
          stageCountsQuerySchema.parse(req.query),
        ),
      ),
    ),
  );
  router.get(
    "/boards/:boardKey/leads",
    handle(async (req, res) =>
      res.json(await leads.list(actor(req), req.params.boardKey)),
    ),
  );
  router.post(
    "/boards/:boardKey/leads",
    handle(async (req, res) =>
      res
        .status(201)
        .json(
          await leads.create(
            actor(req),
            req.params.boardKey,
            normalize(createLeadSchema.parse(req.body)),
          ),
        ),
    ),
  );
  router.get(
    "/boards/:boardKey/leads/:id",
    handle(async (req, res) =>
      res.json(
        await leads.read(actor(req), req.params.boardKey, req.params.id),
      ),
    ),
  );
  router.patch(
    "/boards/:boardKey/leads/:id",
    handle(async (req, res) =>
      res.json(
        await leads.update(
          actor(req),
          req.params.boardKey,
          req.params.id,
          normalize(updateLeadSchema.parse(req.body)),
        ),
      ),
    ),
  );
  router.delete(
    "/boards/:boardKey/leads/:id",
    handle(async (req, res) => {
      await leads.delete(actor(req), req.params.boardKey, req.params.id);
      res.status(204).end();
    }),
  );
  router.patch(
    "/boards/:boardKey/leads/:id/move",
    handle(async (req, res) =>
      res.json(
        await leads.move(
          actor(req),
          req.params.boardKey,
          req.params.id,
          moveLeadSchema.parse(req.body),
        ),
      ),
    ),
  );
  router.get(
    "/boards/:boardKey/leads/:id/activity",
    handle(async (req, res) =>
      res.json(
        await leads.activity(actor(req), req.params.boardKey, req.params.id),
      ),
    ),
  );
  router.get(
    "/boards/:boardKey/leads/:id/files",
    handle(async (req, res) =>
      res.json(
        await files.list(actor(req), req.params.boardKey, req.params.id),
      ),
    ),
  );
  router.post(
    "/boards/:boardKey/leads/:id/files",
    leadFileUpload,
    handle(async (req, res) => {
      if (!req.file) throw new AppError("validation", "A file is required");
      res
        .status(201)
        .json(
          await files.attach(actor(req), req.params.boardKey, req.params.id, {
            bytes: req.file.buffer,
            name: uploadedName(req.file),
            contentType: req.file.mimetype,
          }),
        );
    }),
  );
  router.get(
    "/boards/:boardKey/conversion-events",
    handle(async (req, res) => res.json(await events.list(actor(req), req.params.boardKey))),
  );
  router.post(
    "/boards/:boardKey/conversion-events",
    handle(async (req, res) => {
      res.status(201).json(await events.create(actor(req), req.params.boardKey, createConversionEventSchema.parse(req.body)));
    }),
  );
  router.patch(
    "/boards/:boardKey/conversion-events/:id",
    handle(async (req, res) => res.json(await events.update(actor(req), req.params.boardKey, req.params.id, updateConversionEventSchema.parse(req.body)))),
  );
  router.delete(
    "/boards/:boardKey/conversion-events/:id",
    handle(async (req, res) => {
      await events.remove(actor(req), req.params.boardKey, req.params.id);
      res.status(204).end();
    }),
  );
  router.get(
    "/boards/:boardKey/leads/:id/notes",
    handle(async (req, res) => res.json(await notes.list(actor(req), req.params.boardKey, req.params.id))),
  );
  router.post(
    "/boards/:boardKey/leads/:id/notes",
    handle(async (req, res) => {
      res.status(201).json(await notes.add(actor(req), req.params.boardKey, req.params.id, leadNoteSchema.parse(req.body)));
    }),
  );
  router.patch(
    "/boards/:boardKey/leads/:id/notes/:noteId",
    handle(async (req, res) => {
      res.json(await notes.edit(actor(req), req.params.boardKey, req.params.id, req.params.noteId, leadNoteSchema.parse(req.body)));
    }),
  );
  router.delete(
    "/boards/:boardKey/leads/:id/notes/:noteId",
    handle(async (req, res) => {
      await notes.remove(actor(req), req.params.boardKey, req.params.id, req.params.noteId);
      res.status(204).end();
    }),
  );
  router.get(
    "/boards/:boardKey/leads/:id/files/:fileId",
    handle(async (req, res) => {
      const file = await files.read(
        actor(req),
        req.params.boardKey,
        req.params.id,
        req.params.fileId,
      );
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="file"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      );
      res.send(Buffer.from(file.body));
    }),
  );
  router.delete(
    "/boards/:boardKey/leads/:id/files/:fileId",
    handle(async (req, res) => {
      await files.remove(
        actor(req),
        req.params.boardKey,
        req.params.id,
        req.params.fileId,
      );
      res.status(204).end();
    }),
  );
  router.get(
    "/boards/:boardKey/columns",
    handle(async (req, res) =>
      res.json(await leads.columns(actor(req), req.params.boardKey)),
    ),
  );
  router.post(
    "/boards/:boardKey/columns",
    handle(async (req, res) =>
      res
        .status(201)
        .json(
          await leads.createColumn(
            actor(req),
            req.params.boardKey,
            createColumnSchema.parse(req.body),
          ),
        ),
    ),
  );
  router.patch(
    "/boards/:boardKey/columns/:id",
    handle(async (req, res) =>
      res.json(
        await leads.updateColumn(
          actor(req),
          req.params.boardKey,
          req.params.id,
          updateColumnSchema.parse(req.body),
        ),
      ),
    ),
  );
  router.delete(
    "/boards/:boardKey/columns/:id",
    handle(async (req, res) => {
      await leads.deleteColumn(actor(req), req.params.boardKey, req.params.id);
      res.status(204).end();
    }),
  );
  router.get(
    "/boards/:boardKey/fields",
    handle(async (req, res) =>
      res.json(await fields.list(actor(req), req.params.boardKey)),
    ),
  );
  router.post(
    "/boards/:boardKey/fields",
    handle(async (req, res) =>
      res
        .status(201)
        .json(
          await fields.create(
            actor(req),
            req.params.boardKey,
            createFieldSchema.parse(req.body),
          ),
        ),
    ),
  );
  router.patch(
    "/boards/:boardKey/fields/:id",
    handle(async (req, res) =>
      res.json(
        await fields.update(
          actor(req),
          req.params.boardKey,
          req.params.id,
          updateFieldSchema.parse(req.body),
        ),
      ),
    ),
  );
  router.delete(
    "/boards/:boardKey/fields/:id",
    handle(async (req, res) => {
      await fields.delete(actor(req), req.params.boardKey, req.params.id);
      res.status(204).end();
    }),
  );
  router.get("/clients/:clientId/companies", handle(async (req, res) => res.json(await records.companies(actor(req), req.params.clientId))));
  router.post("/clients/:clientId/companies", handle(async (req, res) =>
    res.status(201).json(await records.createCompany(actor(req), req.params.clientId, createCompanySchema.parse(req.body)))));
  router.get("/clients/:clientId/companies/:id", handle(async (req, res) => res.json(await records.company(actor(req), req.params.clientId, req.params.id))));
  router.patch("/clients/:clientId/companies/:id", handle(async (req, res) =>
    res.json(await records.updateCompany(actor(req), req.params.clientId, req.params.id, updateCompanySchema.parse(req.body)))));
  router.delete("/clients/:clientId/companies/:id", handle(async (req, res) => {
    await records.deleteCompany(actor(req), req.params.clientId, req.params.id);
    res.status(204).end();
  }));
  router.get("/clients/:clientId/people", handle(async (req, res) => res.json(await records.people(actor(req), req.params.clientId))));
  router.post("/clients/:clientId/people", handle(async (req, res) =>
    res.status(201).json(await records.createPerson(actor(req), req.params.clientId, createPersonSchema.parse(req.body)))));
  router.get("/clients/:clientId/people/:id", handle(async (req, res) => res.json(await records.person(actor(req), req.params.clientId, req.params.id))));
  router.patch("/clients/:clientId/people/:id", handle(async (req, res) =>
    res.json(await records.updatePerson(actor(req), req.params.clientId, req.params.id, updatePersonSchema.parse(req.body)))));
  router.delete("/clients/:clientId/people/:id", handle(async (req, res) => {
    await records.deletePerson(actor(req), req.params.clientId, req.params.id);
    res.status(204).end();
  }));
  return router;
}
