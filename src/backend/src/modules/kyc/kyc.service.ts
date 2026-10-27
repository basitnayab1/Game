export function isAdult(dateOfBirth:Date, now=new Date()):boolean {
  const cutoff=new Date(Date.UTC(now.getUTCFullYear()-18,now.getUTCMonth(),now.getUTCDate()));
  return dateOfBirth <= cutoff;
}
/**
 * Production KYC must use an authorized KYC/identity provider where required.
 * Document files belong in restricted object storage, never public URLs.
 */
