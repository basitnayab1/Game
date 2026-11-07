/**
 * What each admin role may do. Paths are relative to /api/v1/admin.
 *   super_admin  Owner: everything, including the team and the activity log.
 *   admin        Manager: everything except the team and the activity log.
 *   finance      Deposits, withdrawals, payment methods (view), players (view).
 *   support      Players (view, password reset, KYC), support tickets.
 */
export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Owner',
  admin: 'Manager',
  finance: 'Finance',
  support: 'Support',
};

type Rule = { method: string; path: RegExp };
const r = (method: string, path: string): Rule => ({ method, path: new RegExp(`^${path}$`) });

const ID = '[^/]+';
const EVERY_ADMIN: Rule[] = [r('GET', '/me'), r('PATCH', '/me/username'), r('POST', `/2fa/${ID}`), r('GET', '/overview'), r('GET', '/users'), r('GET', `/users/${ID}`)];

const ROLE_RULES: Record<string, Rule[]> = {
  finance: [
    r('GET', '/deposits'), r('POST', `/deposits/${ID}/(approve|reject)`),
    r('GET', '/withdrawals'), r('POST', `/withdrawals/${ID}/(approve|reject|payout-success|payout-failure)`),
    r('GET', '/payment-methods'),
  ],
  support: [
    r('POST', `/users/${ID}/reset-password`), r('PATCH', `/users/${ID}/kyc`),
    r('GET', '/support/tickets'), r('GET', `/support/tickets/${ID}`), r('PATCH', `/support/tickets/${ID}/status`),
  ],
};

const OWNER_ONLY = /^\/(team|audit)(\/|$)/;

/** The part of the URL after /admin, without the query string. */
export function adminPath(originalUrl: string | undefined): string {
  const path = String(originalUrl || '').split('?')[0];
  const i = path.indexOf('/admin/');
  return i >= 0 ? path.slice(i + '/admin'.length) : '';
}

export function roleAllows(role: string, method: string, path: string): boolean {
  if (role === 'super_admin') return true;
  if (OWNER_ONLY.test(path)) return false;
  if (role === 'admin') return true;
  const m = method.toUpperCase() === 'HEAD' ? 'GET' : method.toUpperCase();
  return [...EVERY_ADMIN, ...(ROLE_RULES[role] ?? [])].some((rule) => rule.method === m && rule.path.test(path));
}
