import jwt from 'jsonwebtoken'; import { env } from '../config/env.js';
function requiredSecret(value: string | undefined, name: string): string { if (!value) throw new Error(`${name}_NOT_CONFIGURED`); return value; }

export type AccessClaims={sub:string,type:'access',sid:string}; export type RefreshClaims={sub:string,type:'refresh',sid:string};
export function signAccessToken(userId:string,sessionId:string){return jwt.sign({sub:userId,type:'access',sid:sessionId},requiredSecret(env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET'),{expiresIn:`${env.ACCESS_TOKEN_MINUTES}m`});}
export function signRefreshToken(userId:string,sessionId:string){return jwt.sign({sub:userId,type:'refresh',sid:sessionId},requiredSecret(env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET'),{expiresIn:`${env.REFRESH_TOKEN_DAYS}d`});}
export function verifyAccess(token:string){return jwt.verify(token,requiredSecret(env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET')) as AccessClaims;}
export function verifyRefresh(token:string){return jwt.verify(token,requiredSecret(env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET')) as RefreshClaims;}
