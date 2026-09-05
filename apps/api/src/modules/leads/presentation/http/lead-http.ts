import { Router, type Request, type Response, type NextFunction } from 'express';
import { AppError } from '#shared/domain/index.js';
import type { LeadUseCases } from '../../application/lead-use-cases.js';
import { createLeadSchema, updateLeadSchema, moveLeadSchema, normalize } from './lead-schemas.js';
export function createLeadRouter(leads:LeadUseCases) {
  const router=Router();
  const handle=(fn:(req:Request<{boardKey:string;id:string}>,res:Response)=>Promise<unknown>)=>(req:Request<{boardKey:string;id:string}>,res:Response,next:NextFunction)=>{void fn(req,res).catch(next);};
  const actor=(req:Request)=>{if(!req.actor) throw new AppError('unauthorized','Authentication required'); return req.actor;};
  router.get('/boards',handle(async(req,res)=>res.json(await leads.boards(actor(req)))));
  router.get('/boards/:boardKey/leads',handle(async(req,res)=>res.json(await leads.list(actor(req),req.params.boardKey))));
  router.post('/boards/:boardKey/leads',handle(async(req,res)=>res.status(201).json(await leads.create(actor(req),req.params.boardKey,normalize(createLeadSchema.parse(req.body))))));
  router.get('/boards/:boardKey/leads/:id',handle(async(req,res)=>res.json(await leads.read(actor(req),req.params.boardKey,req.params.id))));
  router.patch('/boards/:boardKey/leads/:id',handle(async(req,res)=>res.json(await leads.update(actor(req),req.params.boardKey,req.params.id,normalize(updateLeadSchema.parse(req.body))))));
  router.delete('/boards/:boardKey/leads/:id',handle(async(req,res)=>{await leads.delete(actor(req),req.params.boardKey,req.params.id);res.status(204).end();}));
  router.patch('/boards/:boardKey/leads/:id/move',handle(async(req,res)=>res.json(await leads.move(actor(req),req.params.boardKey,req.params.id,moveLeadSchema.parse(req.body)))));
  return router;
}
