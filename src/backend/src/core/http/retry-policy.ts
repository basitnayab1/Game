export function isSafeToRetryAfterAuthRefresh(method: string, markedSafe: boolean): boolean {
  if (!markedSafe) return false;
  return method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD' || method.toUpperCase() === 'OPTIONS';
}

export function isFinancialMutation(method: string, markedFinancial: boolean): boolean {
  if (markedFinancial) return true;
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}
