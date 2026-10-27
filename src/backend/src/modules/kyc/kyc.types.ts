export type KycStatus="not_started"|"in_progress"|"verified"|"rejected"|"additional_information_required";
export interface KycProfile { id:string; userId:string; status:KycStatus; providerReference?:string; verifiedAt?:Date; }
export interface KycDocument { id:string; kycProfileId:string; documentType:string; storageKey:string; status:"pending"|"accepted"|"rejected"; }
export const kycRules=Object.freeze({
  ageCheckServerSide:true,
  providerVerificationServerSide:true,
  documentsPrivate:true,
  publicDocumentUrls:false,
  auditChanges:true,
});
