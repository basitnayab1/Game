import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { getVipSummary, listVipLevels, getVipLevel as getVipLevelData, listVipRewardHistory } from './vip.service.js';
function uid(req:Request){return (req.auth as {userId?:string}|undefined)?.userId;}
function db(req:Request){return (req.app.locals as {db?:DatabaseClient}).db;}
function ready(req:Request,res:Response){const u=uid(req),d=db(req);if(!u){res.status(401).json({ok:false,error:{code:'AUTHENTICATION_REQUIRED'}});return null;}if(!d){res.status(503).json({ok:false,error:{code:'DATABASE_NOT_CONFIGURED'}});return null;}return {u,d};}
export async function getVip(req:Request,res:Response){const x=ready(req,res);if(!x)return;try{return res.json({ok:true,data:{summary:await getVipSummary(x.d,x.u),levels:await listVipLevels(x.d)}})}catch(e){return res.status(500).json({ok:false,error:{code:e instanceof Error?e.message:'VIP_READ_FAILED'}})}}
export async function getVipLevel(req:Request,res:Response){const x=ready(req,res);if(!x)return;const level=Number(String(req.params.level));if(!Number.isInteger(level)||level<1||level>20)return res.status(400).json({ok:false,error:{code:'INVALID_VIP_LEVEL'}});try{return res.json({ok:true,data:await getVipLevelData(x.d,level)})}catch(e){return res.status(404).json({ok:false,error:{code:e instanceof Error?e.message:'VIP_LEVEL_NOT_FOUND'}})}}
export async function getVipHistory(req:Request,res:Response){const x=ready(req,res);if(!x)return;try{return res.json({ok:true,data:await listVipRewardHistory(x.d,x.u)})}catch(_){return res.status(500).json({ok:false,error:{code:'VIP_HISTORY_READ_FAILED'}})}}
