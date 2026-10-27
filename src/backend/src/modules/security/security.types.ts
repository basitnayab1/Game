export interface SecurityEvent {
 id:string; userId:string; type:string; ipHash?:string; deviceId?:string; createdAt:Date;
}
export interface DeviceSession {
 id:string; userId:string; deviceId:string; revokedAt?:Date; expiresAt:Date;
}
export const securityRules=Object.freeze({
  passwordsHashed:true,
  refreshTokensStoredAsHashes:true,
  rateLimitSensitiveActions:true,
  revokeOtherDevicesServerSide:true,
  secretsNeverLogged:true,
});
