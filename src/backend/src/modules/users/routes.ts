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
    const user = (await db.query<{ id: string; phone_e164: string; date_of_birth: string; phone_verified_at: string | null; status: string; created_at: string; country_code: string | null; must_change_password: boolean; display_name: string | null }>(
      `SELECT u.id, u.phone_e164, to_char(u.date_of_birth, 'YYYY-MM-DD') AS date_of_birth, u.phone_verified_at, u.status, u.created_at, u.must_change_password, p.country_code, p.display_name
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
        // New accounts start with their phone number as the name.
        displayName: user.display_name && user.display_name !== user.phone_e164 ? user.display_name : null,
        mustChangePassword: user.must_change_password,
        status: user.status,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error("[USERS:ME]", (err as Error).message);
    return res.status(500).json({ ok: false, error: { code: "PROFILE_READ_FAILED" } });
  }
});

// Letters (any language), digits, spaces and . _ - ; 3 to 24 characters.
const DISPLAY_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,22}[\p{L}\p{N}]$/u;

usersRouter.patch("/me", requireAuth, async (req: AuthRequest, res) => {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) {
    return res.status(503).json({ ok: false, error: { code: "AUTH_STORE_UNAVAILABLE" } });
  }
  const name = typeof req.body?.displayName === "string" ? req.body.displayName.trim().replace(/\s+/g, " ") : "";
  if (!DISPLAY_NAME.test(name)) {
    return res.status(400).json({
      ok: false,
      error: { code: "INVALID_DISPLAY_NAME", message: "Name must be 3-24 letters or numbers (spaces, . _ - allowed)." },
    });
  }
  try {
    await db.query(
      `INSERT INTO user_profiles (user_id, display_name) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [req.auth!.userId, name],
    );
    return res.json({ ok: true, data: { displayName: name } });
  } catch (err) {
    console.error("[USERS:UPDATE_NAME]", (err as Error).message);
    return res.status(500).json({ ok: false, error: { code: "PROFILE_UPDATE_FAILED" } });
  }
});
