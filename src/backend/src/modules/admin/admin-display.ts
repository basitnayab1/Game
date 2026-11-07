/**
 * The phone number shown for an account in the admin panel, alerts and logs.
 * Admin accounts never show their number: "@username", or "Admin" if none is set.
 * `userIdSql` / `phoneSql` are the SQL expressions for the user's id and phone.
 */
export function shownPhoneSql(userIdSql: string, phoneSql: string): string {
  return `(CASE WHEN EXISTS (SELECT 1 FROM admin_users ax WHERE ax.user_id = ${userIdSql})
            THEN COALESCE('@' || (SELECT ax.username FROM admin_users ax WHERE ax.user_id = ${userIdSql}), 'Admin')
            ELSE ${phoneSql} END)`;
}

/** Shorthand for a query that joins users as `u`. */
export const SHOWN_PHONE = shownPhoneSql('u.id', 'u.phone_e164');
