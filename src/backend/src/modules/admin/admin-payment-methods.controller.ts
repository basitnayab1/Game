import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';

export async function listAdminPaymentMethods(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) {
    return res.json({ ok: true, data: [] });
  }

  try {
    const result = await db.query(`
      SELECT id, country_code, category, name, account_title, account_number,
             instructions, min_deposit, max_deposit, active, badge_text, display_order,
             created_at, updated_at
      FROM admin_payment_methods
      ORDER BY display_order ASC, name ASC
    `);
    return res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'LIST_PAYMENT_METHODS_FAILED', message: error.message } });
  }
}

export async function createAdminPaymentMethod(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) {
    return res.status(500).json({ ok: false, error: { code: 'NO_DATABASE', message: 'Database client not connected.' } });
  }

  const {
    country_code = 'ALL',
    category = 'wallet',
    name,
    account_title = '',
    account_number,
    instructions = '',
    min_deposit = 100,
    max_deposit = 100000,
    active = true,
    badge_text = '',
    display_order = 0,
  } = req.body || {};

  if (!name || !account_number) {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Name and Account Number are required.' } });
  }

  try {
    const result = await db.query(`
      INSERT INTO admin_payment_methods 
        (country_code, category, name, account_title, account_number, instructions, min_deposit, max_deposit, active, badge_text, display_order, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
    `, [country_code, category, name, account_title, account_number, instructions, Number(min_deposit), Number(max_deposit), Boolean(active), badge_text, Number(display_order)]);

    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'CREATE_PAYMENT_METHOD_FAILED', message: error.message } });
  }
}

export async function updateAdminPaymentMethod(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) {
    return res.status(500).json({ ok: false, error: { code: 'NO_DATABASE', message: 'Database client not connected.' } });
  }

  const { id } = req.params;
  const {
    country_code,
    category,
    name,
    account_title,
    account_number,
    instructions,
    min_deposit,
    max_deposit,
    active,
    badge_text,
    display_order,
  } = req.body || {};

  try {
    const result = await db.query(`
      UPDATE admin_payment_methods
      SET country_code = COALESCE($1, country_code),
          category = COALESCE($2, category),
          name = COALESCE($3, name),
          account_title = COALESCE($4, account_title),
          account_number = COALESCE($5, account_number),
          instructions = COALESCE($6, instructions),
          min_deposit = COALESCE($7, min_deposit),
          max_deposit = COALESCE($8, max_deposit),
          active = COALESCE($9, active),
          badge_text = COALESCE($10, badge_text),
          display_order = COALESCE($11, display_order),
          updated_at = NOW()
      WHERE id = $12
      RETURNING *
    `, [country_code, category, name, account_title, account_number, instructions, min_deposit, max_deposit, active, badge_text, display_order, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Payment method not found.' } });
    }

    return res.json({ ok: true, data: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'UPDATE_PAYMENT_METHOD_FAILED', message: error.message } });
  }
}

export async function deleteAdminPaymentMethod(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) {
    return res.status(500).json({ ok: false, error: { code: 'NO_DATABASE', message: 'Database client not connected.' } });
  }

  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM admin_payment_methods WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Payment method not found.' } });
    }
    return res.json({ ok: true, data: { id, deleted: true } });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'DELETE_PAYMENT_METHOD_FAILED', message: error.message } });
  }
}

export async function getPublicPaymentConfig(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const country = String(req.query.country || '').trim().toUpperCase();

  if (!db) {
    return res.json({ ok: true, data: [] });
  }

  try {
    let query = 'SELECT id, country_code, category, name, account_title, account_number, instructions, min_deposit, max_deposit, badge_text, display_order FROM admin_payment_methods WHERE active = true';
    const params: string[] = [];

    if (country) {
      query += ' AND (country_code = $1 OR country_code = \'ALL\')';
      params.push(country);
    }
    query += ' ORDER BY display_order ASC, name ASC';

    const result = await db.query(query, params);
    return res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'FETCH_PUBLIC_PAYMENTS_FAILED', message: error.message } });
  }
}

