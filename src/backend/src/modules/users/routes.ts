import { Router } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth.js";
import type { DatabaseClient } from "../../core/database/database.types.js";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) {
    return res.status(503).json({ ok: false, error: { code: "AUTH_STORE_UNAVAILABLE" } });
  }

  try {
    const user = (await db.query<{ id: string; phone_e164: string; date_of_birth: string; phone_verified_at: string | null; status: string; created_at: string; country_code: string | null }>(
      `SELECT u.id, u.phone_e164, to_char(u.date_of_birth, 'YYYY-MM-DD') AS date_of_birth, u.phone_verified_at, u.status, u.created_at, p.country_code
         FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = $1`,
      [req.auth!.userId],
    )).rows[0];
    if (!user) {
      return res.status(401).json({
        ok: false,
        error: { code: "SESSION_INVALID", message: "Authenticated user is no longer available" },
      });
    }

    return res.json({
      ok: true,
      data: {
        id: user.id,
        phone: user.phone_e164,
        dob: user.date_of_birth,
        phoneVerified: Boolean(user.phone_verified_at),
        countryCode: user.country_code ?? 'PK',
        status: user.status,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error("[USERS:ME]", (err as Error).message);
    return res.status(500).json({ ok: false, error: { code: "PROFILE_READ_FAILED" } });
  }
});
