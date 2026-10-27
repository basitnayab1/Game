import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { getFavorites, getRecentlyPlayed, setFavorite } from './player-state.service.js';

function dbOf(req: Request): DatabaseClient | undefined { return (req.app.locals as {db?: DatabaseClient}).db; }
function userIdOf(req: Request): string | undefined { return (req as Request & {auth?: {userId:string}}).auth?.userId; }

export async function listFavorites(req: Request,res: Response){
  const db=dbOf(req), userId=userIdOf(req); if(!db) return res.status(503).json({ok:false,error:{code:'DATABASE_NOT_CONFIGURED'}}); if(!userId) return res.status(401).json({ok:false,error:{code:'UNAUTHORIZED'}});
  try{return res.json({ok:true,data:await getFavorites(db,userId)});}catch{return res.status(500).json({ok:false,error:{code:'FAVORITES_READ_FAILED'}});}
}
export async function updateFavorite(req: Request,res: Response){
  const db=dbOf(req), userId=userIdOf(req), gameId=typeof req.params.gameId === 'string' ? req.params.gameId : '';
  if(!db) return res.status(503).json({ok:false,error:{code:'DATABASE_NOT_CONFIGURED'}}); if(!userId) return res.status(401).json({ok:false,error:{code:'UNAUTHORIZED'}});
  if(!gameId) return res.status(400).json({ok:false,error:{code:'INVALID_GAME_ID'}});
  try{await setFavorite(db,userId,gameId,req.method==='PUT'); return res.json({ok:true});}catch{return res.status(500).json({ok:false,error:{code:'FAVORITE_UPDATE_FAILED'}});}
}
export async function listRecentlyPlayed(req: Request,res: Response){
  const db=dbOf(req), userId=userIdOf(req); if(!db) return res.status(503).json({ok:false,error:{code:'DATABASE_NOT_CONFIGURED'}}); if(!userId) return res.status(401).json({ok:false,error:{code:'UNAUTHORIZED'}});
  try{return res.json({ok:true,data:await getRecentlyPlayed(db,userId)});}catch{return res.status(500).json({ok:false,error:{code:'RECENT_READ_FAILED'}});}
}
