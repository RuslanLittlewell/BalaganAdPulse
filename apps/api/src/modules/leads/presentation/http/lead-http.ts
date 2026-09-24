import { Router, type Request, type Response, type NextFunction } from 'express';
import { AppError } from '#shared/domain/index.js';
import type { LeadUseCases } from '../../application/lead-use-cases.js';
import type { LeadFileUseCases } from '../../application/lead-file-use-cases.js';
import { leadFileUpload, uploadedName } from './lead-file-upload.js';
import { createLeadSchema, updateLeadSchema, moveLeadSchema, createColumnSchema, updateColumnSchema, stageCountsQuerySchema, normalize } from './lead-schemas.js';
export function createLeadRouter(leads:LeadUseCases, files:LeadFileUseCases) {
  const router=Router();
  const handle=(fn:(req:Request<{boardKey:string;id:string;fileId:string}>,res:Response)=>Promise<unknown>)=>(req:Request<{boardKey:string;id:string;fileId:string}>,res:Response,next:NextFunction)=>{void fn(req,res).catch(next);};
  const actor=(req:Request)=>{if(!req.actor) throw new AppError('unauthorized','Authentication required'); return req.actor;};
  router.get('/project-stage-counts',handle(async(req,res)=>res.json(await leads.projectStageCounts(actor(req),stageCountsQuerySchema.parse(req.query)))));
  router.get('/boards',handle(async(req,res)=>res.json(await leads.boards(actor(req)))));
  router.get('/boards/:boardKey/leads',handle(async(req,res)=>res.json(await leads.list(actor(req),req.params.boardKey))));
  router.post('/boards/:boardKey/leads',handle(async(req,res)=>res.status(201).json(await leads.create(actor(req),req.params.boardKey,normalize(createLeadSchema.parse(req.body))))));
  router.get('/boards/:boardKey/leads/:id',handle(async(req,res)=>res.json(await leads.read(actor(req),req.params.boardKey,req.params.id))));
  router.patch('/boards/:boardKey/leads/:id',handle(async(req,res)=>res.json(await leads.update(actor(req),req.params.boardKey,req.params.id,normalize(updateLeadSchema.parse(req.body))))));
  router.delete('/boards/:boardKey/leads/:id',handle(async(req,res)=>{await leads.delete(actor(req),req.params.boardKey,req.params.id);res.status(204).end();}));
  router.patch('/boards/:boardKey/leads/:id/move',handle(async(req,res)=>res.json(await leads.move(actor(req),req.params.boardKey,req.params.id,moveLeadSchema.parse(req.body)))));
  router.get('/boards/:boardKey/leads/:id/activity',handle(async(req,res)=>res.json(await leads.activity(actor(req),req.params.boardKey,req.params.id))));
  router.get('/boards/:boardKey/leads/:id/files',handle(async(req,res)=>res.json(await files.list(actor(req),req.params.boardKey,req.params.id))));
  router.post('/boards/:boardKey/leads/:id/files',leadFileUpload,handle(async(req,res)=>{
    if(!req.file) throw new AppError('validation','A file is required');
    res.status(201).json(await files.attach(actor(req),req.params.boardKey,req.params.id,{bytes:req.file.buffer,name:uploadedName(req.file),contentType:req.file.mimetype}));
  }));
  router.get('/boards/:boardKey/leads/:id/files/:fileId',handle(async(req,res)=>{
    const file=await files.read(actor(req),req.params.boardKey,req.params.id,req.params.fileId);
    res.setHeader('Content-Type','application/octet-stream');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('Content-Disposition',`attachment; filename="file"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.send(Buffer.from(file.body));
  }));
  router.delete('/boards/:boardKey/leads/:id/files/:fileId',handle(async(req,res)=>{await files.remove(actor(req),req.params.boardKey,req.params.id,req.params.fileId);res.status(204).end();}));
  router.get('/boards/:boardKey/columns',handle(async(req,res)=>res.json(await leads.columns(actor(req),req.params.boardKey))));
  router.post('/boards/:boardKey/columns',handle(async(req,res)=>res.status(201).json(await leads.createColumn(actor(req),req.params.boardKey,createColumnSchema.parse(req.body)))));
  router.patch('/boards/:boardKey/columns/:id',handle(async(req,res)=>res.json(await leads.updateColumn(actor(req),req.params.boardKey,req.params.id,updateColumnSchema.parse(req.body)))));
  router.delete('/boards/:boardKey/columns/:id',handle(async(req,res)=>{await leads.deleteColumn(actor(req),req.params.boardKey,req.params.id);res.status(204).end();}));
  return router;
}
