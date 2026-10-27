import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import crypto from 'node:crypto';
import { PaymentGatewayService } from './payment-gateway.service.js';
import { PaymentIdempotencyService } from './payment-idempotency.service.js';

function paymentsStoreUnavailable(res: Response) {
  return res.status(503).json({ ok: false, error: { code: 'PAYMENTS_STORE_UNAVAILABLE', message: 'Payments require the PostgreSQL database to be configured.' } });
}

export async function requestDeposit(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const userId = String((req as any).auth?.userId || (req as any).user?.id || '').trim();
  if (!userId) {
    return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }
  if (!db) return paymentsStoreUnavailable(res);

  const { amountPkr, amount: rawAmount, gateway = 'easypaisa', trxId, senderPhone, note, cnicLast6, currency = 'PKR', mode: rawMode } = req.body || {};
  const amount = Number(amountPkr !== undefined ? amountPkr : rawAmount);

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_AMOUNT', message: 'Valid deposit amount is required.' } });
  }

  const mode: 'manual' | 'automatic' = rawMode === 'automatic' || (!trxId && rawMode !== 'manual') ? 'automatic' : 'manual';
  const cleanTrx = String(trxId || '').trim();

  // 1. Manual mode strictly requires a valid carrier TRX ID
  if (mode === 'manual') {
    if (!cleanTrx) {
      return res.status(400).json({ ok: false, error: { code: 'TRX_REQUIRED', message: 'Transaction ID / TRX is required for manual deposit mode.' } });
    }

    const trxCheck = PaymentGatewayService.validateTrxPattern(gateway, cleanTrx);
    if (!trxCheck.valid) {
      return res.status(400).json({ ok: false, error: { code: 'INVALID_TRX_FORMAT', message: trxCheck.reason } });
    }
  }

  const amountMinor = Math.round(amount * 100);

  // 2. Resolve Idempotency Key (scoped to user & deposit operation)
  const rawIdempotencyKey = PaymentIdempotencyService.extractIdempotencyKey(req);
  const idempotencyKey =
    rawIdempotencyKey ||
    (mode === 'manual'
      ? `trx:${gateway.toLowerCase()}:${cleanTrx.toLowerCase()}`
      : `auto:${userId}:${gateway.toLowerCase()}:${amountMinor}`);

  const payloadHash = PaymentIdempotencyService.computePayloadHash({
    mode,
    amount: amountMinor,
    gateway: gateway.toLowerCase(),
    trxId: cleanTrx ? cleanTrx.toLowerCase() : null,
    senderPhone: senderPhone ? String(senderPhone).trim() : null,
    currency,
  });

  // 3. Check or Acquire Idempotency Lock
  const idempotency = await PaymentIdempotencyService.acquire(db, {
    userId,
    scope: 'deposit',
    key: idempotencyKey,
    requestHash: payloadHash,
  });

  if (idempotency.action === 'replay' && idempotency.cachedResponse) {
    return res.status(idempotency.cachedResponse.statusCode).json(idempotency.cachedResponse.body);
  }

  if (idempotency.action === 'conflict') {
    return res.status(409).json({
      ok: false,
      error: { code: 'IDEMPOTENCY_CONFLICT', message: idempotency.conflictReason || 'Conflicting payload for idempotency key.' },
    });
  }

  if (idempotency.action === 'in_progress') {
    return res.status(409).json({
      ok: false,
      error: { code: 'REQUEST_IN_PROGRESS', message: idempotency.conflictReason || 'Request with this idempotency key is currently processing.' },
    });
  }

  if (idempotency.action === 'unavailable') {
    return res.status(503).json({
      ok: false,
      error: { code: 'IDEMPOTENCY_UNAVAILABLE', message: idempotency.conflictReason || 'Idempotency store is temporarily unavailable.' },
    });
  }

  // 4. Provider-scoped reference uniqueness check for manual deposits
  if (cleanTrx) {
    const isUniqueRef = await PaymentIdempotencyService.isDepositReferenceUnique(db, gateway, cleanTrx);
    if (!isUniqueRef) {
      await PaymentIdempotencyService.fail(db, {
        userId,
        scope: 'deposit',
        key: idempotencyKey,
        errorMessage: 'This TRX ID has already been submitted for this payment provider.',
      });
      return res.status(409).json({
        ok: false,
        error: { code: 'DUPLICATE_TRX_ID', message: 'This TRX ID has already been submitted for this payment provider.' },
      });
    }
  }

  const txId = crypto.randomUUID();
  const depositId = crypto.randomUUID();

  // 5. Initiate payment via PaymentGatewayService (explicit mode dispatch)
  let gatewayResult;
  try {
    gatewayResult = await PaymentGatewayService.initiateGatewayPayment({
      mode,
      transactionId: txId,
      userId,
      amountPkr: amount,
      gateway: gateway as any,
      payerPhone: senderPhone || '03000000000',
      cnicLast6,
      idempotencyKey,
      trxId: cleanTrx || undefined,
    });

    if (!gatewayResult.success) {
      await PaymentIdempotencyService.fail(db, {
        userId,
        scope: 'deposit',
        key: idempotencyKey,
        errorMessage: gatewayResult.message || 'Payment gateway rejected transaction',
      });
      const statusCode = gatewayResult.errorCode === 'GATEWAY_CREDENTIALS_MISSING' ? 503 : 502;
      return res.status(statusCode).json({
        ok: false,
        error: { code: gatewayResult.errorCode || 'GATEWAY_ERROR', message: gatewayResult.message || 'Payment gateway rejected transaction' },
      });
    }
  } catch (gwErr: any) {
    await PaymentIdempotencyService.fail(db, {
      userId,
      scope: 'deposit',
      key: idempotencyKey,
      errorMessage: gwErr.message,
    });
    return res.status(502).json({
      ok: false,
      error: { code: 'GATEWAY_ERROR', message: `Payment gateway error: ${gwErr.message}` },
    });
  }

  const effectiveReference = cleanTrx || gatewayResult.providerReference || null;

  try {
    const result = await db.transaction(async (tx) => {
      let wallet = (await tx.query<{ id: string }>(
        `SELECT id FROM wallet_accounts WHERE user_id = $1 AND currency = 'PKR' LIMIT 1`,
        [userId]
      )).rows[0];

      if (!wallet) {
        wallet = (await tx.query<{ id: string }>(
          `INSERT INTO wallet_accounts (user_id, currency, available_minor)
           VALUES ($1, 'PKR', 0)
           ON CONFLICT (user_id, currency) DO UPDATE SET updated_at = now()
           RETURNING id`,
          [userId]
        )).rows[0];
      }

      await tx.query(
        `INSERT INTO transactions (id, user_id, wallet_account_id, type, status, amount_minor, currency, provider_reference, idempotency_key, metadata)
         VALUES ($1, $2, $3, 'deposit', 'pending', $4, 'PKR', $5, $6, $7)`,
        [
          txId,
          userId,
          wallet.id,
          amountMinor,
          effectiveReference,
          idempotencyKey,
          JSON.stringify({
            mode,
            gateway,
            senderPhone: senderPhone || null,
            note: note || null,
            providerReference: gatewayResult.providerReference || effectiveReference,
            paymentUrl: gatewayResult.paymentUrl,
          }),
        ]
      );

      await tx.query(
        `INSERT INTO deposits (id, transaction_id, method, provider_name, provider_reference)
         VALUES ($1, $2, $3, $4, $5)`,
        [depositId, txId, gateway, gateway, effectiveReference]
      );

      return {
        mode,
        transactionId: txId,
        depositId,
        amountPkr: amount,
        amountMinor,
        gateway,
        trxId: effectiveReference,
        providerReference: gatewayResult.providerReference || effectiveReference,
        status: 'pending',
        paymentUrl: gatewayResult.paymentUrl,
        ussdPromptTriggered: gatewayResult.ussdPromptTriggered,
        message: gatewayResult.message,
      };
    });

    const responsePayload = {
      ok: true,
      data: result,
    };

    await PaymentIdempotencyService.complete(db, {
      userId,
      scope: 'deposit',
      key: idempotencyKey,
      statusCode: 201,
      responseBody: responsePayload,
      transactionId: txId,
    });

    return res.status(201).json(responsePayload);
  } catch (error: any) {
    await PaymentIdempotencyService.fail(db, {
      userId,
      scope: 'deposit',
      key: idempotencyKey,
      errorMessage: error?.message || 'Could not process deposit request.',
    });

    if (error?.code === '23505') {
      if (error?.constraint?.includes('deposits_provider_reference') || error?.message?.includes('uq_deposits_provider_reference')) {
        return res.status(409).json({
          ok: false,
          error: { code: 'DUPLICATE_TRX_ID', message: 'This TRX ID has already been submitted for this payment provider.' },
        });
      }
      if (error?.constraint?.includes('transactions_idempotency') || error?.message?.includes('uq_transactions_idempotency')) {
        return res.status(409).json({
          ok: false,
          error: { code: 'IDEMPOTENCY_CONFLICT', message: 'A transaction with this idempotency key already exists.' },
        });
      }
    }

    return res.status(500).json({
      ok: false,
      error: { code: 'DEPOSIT_FAILED', message: error?.message || 'Could not process deposit request.' },
    });
  }
}

export async function requestWithdrawal(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const userId = String((req as any).auth?.userId || (req as any).user?.id || '').trim();
  if (!userId) {
    return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }
  if (!db) return paymentsStoreUnavailable(res);

  const { amountPkr, amount: rawAmount, gateway = 'easypaisa', accountPhone, accountTitle, currency = 'PKR' } = req.body || {};
  const amount = Number(amountPkr !== undefined ? amountPkr : rawAmount);

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_AMOUNT', message: 'Valid withdrawal amount is required.' } });
  }

  const cleanPhone = String(accountPhone || '').trim();
  if (!cleanPhone) {
    return res.status(400).json({ ok: false, error: { code: 'ACCOUNT_PHONE_REQUIRED', message: 'Mobile wallet phone number is required.' } });
  }

  const amountMinor = Math.round(amount * 100);

  // Extract idempotency key & compute hash
  const rawIdempotencyKey = PaymentIdempotencyService.extractIdempotencyKey(req);
  const idempotencyKey = rawIdempotencyKey || `wd:${userId}:${gateway.toLowerCase()}:${amountMinor}:${cleanPhone}`;

  const payloadHash = PaymentIdempotencyService.computePayloadHash({
    amount: amountMinor,
    gateway: gateway.toLowerCase(),
    accountPhone: cleanPhone,
    accountTitle: accountTitle ? String(accountTitle).trim().toLowerCase() : null,
    currency,
  });

  // Acquire Idempotency Lock
  const idempotency = await PaymentIdempotencyService.acquire(db, {
    userId,
    scope: 'withdrawal',
    key: idempotencyKey,
    requestHash: payloadHash,
  });

  if (idempotency.action === 'replay' && idempotency.cachedResponse) {
    return res.status(idempotency.cachedResponse.statusCode).json(idempotency.cachedResponse.body);
  }

  if (idempotency.action === 'conflict') {
    return res.status(409).json({
      ok: false,
      error: { code: 'IDEMPOTENCY_CONFLICT', message: idempotency.conflictReason || 'Conflicting payload for idempotency key.' },
    });
  }

  if (idempotency.action === 'in_progress') {
    return res.status(409).json({
      ok: false,
      error: { code: 'REQUEST_IN_PROGRESS', message: idempotency.conflictReason || 'Request with this idempotency key is currently processing.' },
    });
  }

  if (idempotency.action === 'unavailable') {
    return res.status(503).json({
      ok: false,
      error: { code: 'IDEMPOTENCY_UNAVAILABLE', message: idempotency.conflictReason || 'Idempotency store is temporarily unavailable.' },
    });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const userRow = (await tx.query<{ status: string }>(
        `SELECT status FROM users WHERE id = $1`,
        [userId]
      )).rows[0];

      if (userRow && userRow.status !== 'active') {
        throw { statusCode: 403, code: 'ACCOUNT_RESTRICTED', message: 'Account is restricted or suspended from making withdrawals.' };
      }

      const walletRow = (await tx.query<{ id: string; available_minor: string; locked_minor: string }>(
        `SELECT id, available_minor, locked_minor FROM wallet_accounts
          WHERE user_id = $1 AND currency = 'PKR' FOR UPDATE`,
        [userId]
      )).rows[0];

      if (!walletRow) {
        throw new Error('Wallet account not found.');
      }

      const available = BigInt(walletRow.available_minor);
      const reqMinor = BigInt(amountMinor);

      if (available < reqMinor) {
        throw new Error(`Insufficient balance. Available: PKR ${(Number(available) / 100).toFixed(2)}, Requested: PKR ${amount}`);
      }

      await tx.query(
        `UPDATE wallet_accounts
            SET available_minor = available_minor - $1,
                locked_minor = locked_minor + $1,
                version = version + 1,
                updated_at = now()
          WHERE id = $2`,
        [amountMinor, walletRow.id]
      );

      const txId = crypto.randomUUID();
      const withdrawalId = crypto.randomUUID();

      await tx.query(
        `INSERT INTO transactions (id, user_id, wallet_account_id, type, status, amount_minor, currency, idempotency_key, metadata)
         VALUES ($1, $2, $3, 'withdrawal', 'pending', $4, 'PKR', $5, $6)`,
        [
          txId,
          userId,
          walletRow.id,
          amountMinor,
          idempotencyKey,
          JSON.stringify({ gateway, accountPhone: cleanPhone, accountTitle: accountTitle || null }),
        ]
      );

      await tx.query(
        `INSERT INTO withdrawals (id, transaction_id, amount_minor, fee_minor, net_minor, status)
         VALUES ($1, $2, $3, 0, $3, 'pending')`,
        [withdrawalId, txId, amountMinor]
      );

      return {
        transactionId: txId,
        withdrawalId,
        amountPkr: amount,
        amountMinor,
        gateway,
        accountPhone: cleanPhone,
        status: 'pending',
        remainingAvailablePkr: Number(available - reqMinor) / 100,
      };
    });

    const responsePayload = {
      ok: true,
      data: {
        ...result,
        message: `Withdrawal request of PKR ${amount} submitted! Amount is temporarily held and pending admin review.`,
      },
    };

    await PaymentIdempotencyService.complete(db, {
      userId,
      scope: 'withdrawal',
      key: idempotencyKey,
      statusCode: 201,
      responseBody: responsePayload,
      transactionId: result.transactionId,
    });

    return res.status(201).json(responsePayload);
  } catch (error: any) {
    await PaymentIdempotencyService.fail(db, {
      userId,
      scope: 'withdrawal',
      key: idempotencyKey,
      errorMessage: error?.message || 'Could not process withdrawal request.',
    });

    if (error?.code === 'ACCOUNT_RESTRICTED' || error?.statusCode === 403) {
      return res.status(403).json({
        ok: false,
        error: { code: 'ACCOUNT_RESTRICTED', message: error.message || 'Account is restricted from making withdrawals.' },
      });
    }

    const isInsufficientBalance = error?.message?.includes('Insufficient balance');
    const statusCode = isInsufficientBalance ? 400 : 500;

    return res.status(statusCode).json({
      ok: false,
      error: { code: isInsufficientBalance ? 'INSUFFICIENT_BALANCE' : 'WITHDRAWAL_FAILED', message: error?.message || 'Could not process withdrawal request.' },
    });
  }
}

export async function getPaymentHistory(req: Request, res: Response) {
  const userId = String((req as any).auth?.userId || (req as any).user?.id || '').trim();
  if (!userId) {
    return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }

  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) return paymentsStoreUnavailable(res);

  try {
    const rows = (await db.query<{
      id: string;
      type: string;
      status: string;
      amount_minor: string;
      currency: string;
      provider_reference: string | null;
      metadata: any;
      created_at: string;
    }>(
      `SELECT id, type, status, amount_minor, currency, provider_reference, metadata, created_at
         FROM transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [userId]
    )).rows;

    const formatted = rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      amountPkr: Number(r.amount_minor) / 100,
      currency: r.currency,
      trxId: r.provider_reference,
      gateway: r.metadata?.gateway || 'manual',
      details: r.metadata,
      createdAt: r.created_at,
    }));

    return res.json({ ok: true, data: formatted });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: { code: 'HISTORY_FETCH_FAILED', message: error?.message || 'Failed to fetch transaction history.' },
    });
  }
}

/**
 * Unified Payment Webhook & Durable Idempotent Settlement Receiver
 */
export async function processPaymentWebhook(gateway: string, req: Request, res: Response) {
  const normGateway = String(gateway || '').toLowerCase().trim();
  const db = (req.app.locals as { db?: DatabaseClient }).db;

  // 1. Guard: Check if Webhook Integration is Configured & Enabled
  if (!PaymentGatewayService.isWebhookConfigured(normGateway)) {
    return res.status(503).json({
      ok: false,
      error: {
        code: 'GATEWAY_WEBHOOK_DISABLED',
        message: `Webhook integration for ${gateway} is not configured or disabled (fail-closed).`,
      },
    });
  }
  if (!db) return paymentsStoreUnavailable(res);

  // 2. Strict Signature Verification (HMAC/hash + timing-safe comparison)
  const payload = req.method === 'GET' ? req.query : req.body;
  const verified = PaymentGatewayService.verifyWebhook(
    normGateway,
    payload,
    req.headers,
    (req as any).rawBody
  );

  if (!verified.valid) {
    console.warn(`[PAYMENT:WEBHOOK:INVALID_SIGNATURE] Gateway: ${normGateway}, Reason: ${verified.reason}`);
    return res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_SIGNATURE',
        message: verified.reason || 'Invalid webhook signature.',
      },
    });
  }

  const { transactionId, providerReference, amountMinor, status, rawResponseCode, currency } = verified;
  const rawBodyStr = (req as any).rawBody || JSON.stringify(payload);
  const payloadHash = crypto.createHash('sha256').update(rawBodyStr).digest('hex');
  const eventId = String(providerReference || transactionId || '').trim();

  // Helper function for provider acknowledgment responses
  const sendProviderAck = (msg: string = 'Processed successfully') => {
    if (normGateway === 'jazzcash') {
      return res.json({ pp_ResponseCode: '000', pp_ResponseMessage: msg });
    }
    if (normGateway === 'easypaisa') {
      return res.json({ responseCode: '0000', message: msg });
    }
    return res.json({ ok: true, status: 'completed', message: msg });
  };

  // 3. Database Settlement Workflow
  try {
    // Step A: Replay protection via provider_webhook_events table
    const eventInsert = await db.query<{ id: string; state: string }>(
      `INSERT INTO provider_webhook_events (provider, event_id, event_type, signature_verified, payload_hash, state, metadata)
       VALUES ($1, $2, 'payment.callback', true, $3, 'RECEIVED', $4)
       ON CONFLICT (provider, event_id) DO NOTHING
       RETURNING id, state`,
      [normGateway, eventId, payloadHash, JSON.stringify({ body: payload, rawResponseCode })]
    );

    if (eventInsert.rows.length === 0) {
      // Event ID was already inserted previously. Check its state.
      const existingEvent = (await db.query<{ id: string; state: string }>(
        `SELECT id, state FROM provider_webhook_events WHERE provider = $1 AND event_id = $2`,
        [normGateway, eventId]
      )).rows[0];

      if (existingEvent?.state === 'PROCESSED') {
        // Exactly once guarantee: Repeated callback replay returns 200 OK without re-crediting wallet!
        console.log(`[PAYMENT:WEBHOOK:REPLAY_IGNORED] Replay detected for event ${eventId} on ${normGateway}`);
        return sendProviderAck('Already settled (idempotent replay)');
      }
    }

    // Step B: Atomic Database Transaction with Row-Level Locking
    const settlement = await db.transaction(async (tx) => {
      const candidate1 = transactionId;
      const candidate2 = transactionId.replace(/^N5/, '');
      const candidate3 = `N5${transactionId}`;
      const txRow = (await tx.query<{
        id: string;
        user_id: string;
        wallet_account_id: string;
        type: string;
        status: string;
        amount_minor: string;
        currency: string;
      }>(
        `SELECT id, user_id, wallet_account_id, type, status, amount_minor, currency
           FROM transactions
          WHERE (
            id::text = $1 OR id::text = $2
            OR provider_reference = $1 OR provider_reference = $2 OR provider_reference = $3
            OR provider_reference = $4
            OR (LENGTH($2) >= 8 AND id::text LIKE ($2 || '%'))
          )
          FOR UPDATE`,
        [candidate1, candidate2, candidate3, providerReference || '']
      )).rows[0];

      if (!txRow) {
        await tx.query(
          `UPDATE provider_webhook_events SET state = 'REJECTED', processed_at = now() WHERE provider = $1 AND event_id = $2`,
          [normGateway, eventId]
        );
        return { errorStatus: 404, errorCode: 'UNKNOWN_TRANSACTION', message: `Transaction reference '${transactionId}' not found.` };
      }

      // Out-of-order check: if already completed, don't double credit!
      if (txRow.status === 'completed') {
        await tx.query(
          `UPDATE provider_webhook_events SET state = 'PROCESSED', processed_at = now() WHERE provider = $1 AND event_id = $2`,
          [normGateway, eventId]
        );
        return { alreadyCompleted: true };
      }

      // Out-of-order check: if cancelled or failed
      if (txRow.status === 'cancelled' || txRow.status === 'failed') {
        await tx.query(
          `UPDATE provider_webhook_events SET state = 'REJECTED', processed_at = now() WHERE provider = $1 AND event_id = $2`,
          [normGateway, eventId]
        );
        return { errorStatus: 409, errorCode: 'TRANSACTION_ALREADY_TERMINATED', message: `Transaction is already in '${txRow.status}' state.` };
      }

      // Currency verification
      if (txRow.currency !== currency && txRow.currency !== 'PKR') {
        await tx.query(
          `UPDATE provider_webhook_events SET state = 'REJECTED', processed_at = now() WHERE provider = $1 AND event_id = $2`,
          [normGateway, eventId]
        );
        return { errorStatus: 422, errorCode: 'CURRENCY_MISMATCH', message: `Currency mismatch: expected ${txRow.currency}, got ${currency}` };
      }

      // Amount verification: prevent tampered or altered amounts!
      if (BigInt(txRow.amount_minor) !== BigInt(amountMinor)) {
        console.warn(`[PAYMENT:WEBHOOK:AMOUNT_MISMATCH] For tx ${txRow.id}: expected ${txRow.amount_minor}, got ${amountMinor}`);
        await tx.query(
          `UPDATE provider_webhook_events SET state = 'REJECTED', processed_at = now() WHERE provider = $1 AND event_id = $2`,
          [normGateway, eventId]
        );
        return { errorStatus: 422, errorCode: 'AMOUNT_MISMATCH', message: `Amount mismatch: expected ${txRow.amount_minor} minor units, got ${amountMinor}` };
      }

      // Provider reported failure (e.g. user rejected PIN prompt)
      if (status === 'failed') {
        await tx.query(`UPDATE transactions SET status = 'failed', updated_at = now() WHERE id = $1`, [txRow.id]);
        await tx.query(`UPDATE deposits SET provider_reference = $1 WHERE transaction_id = $2`, [providerReference || null, txRow.id]);
        await tx.query(
          `UPDATE provider_webhook_events SET state = 'PROCESSED', processed_at = now() WHERE provider = $1 AND event_id = $2`,
          [normGateway, eventId]
        );
        return { status: 'failed' };
      }

      // Settlement: Update transaction & deposit
      await tx.query(
        `UPDATE transactions SET status = 'completed', provider_reference = COALESCE($1, provider_reference), updated_at = now() WHERE id = $2`,
        [providerReference || null, txRow.id]
      );

      await tx.query(
        `UPDATE deposits SET provider_reference = COALESCE($1, provider_reference), verified_at = now() WHERE transaction_id = $2`,
        [providerReference || null, txRow.id]
      );

      // Credit wallet available balance
      await tx.query(
        `UPDATE wallet_accounts
            SET available_minor = available_minor + $1,
                version = version + 1,
                updated_at = now()
          WHERE id = $2`,
        [txRow.amount_minor, txRow.wallet_account_id]
      );

      // Double-entry ledger entry with unique idempotency key
      await tx.query(
        `INSERT INTO ledger_entries (wallet_account_id, entry_type, direction, amount_minor, currency, reference_type, reference_id, idempotency_key, metadata)
         VALUES ($1, 'deposit', 'credit', $2, 'PKR', 'transaction', $3, $4, $5)
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
        [
          txRow.wallet_account_id,
          txRow.amount_minor,
          txRow.id,
          `webhook:settlement:${txRow.id}`,
          JSON.stringify({ gateway: normGateway, providerReference, eventId }),
        ]
      );

      // Mark webhook event PROCESSED
      await tx.query(
        `UPDATE provider_webhook_events SET state = 'PROCESSED', processed_at = now() WHERE provider = $1 AND event_id = $2`,
        [normGateway, eventId]
      );

      return { status: 'completed' };
    });

    if (settlement.errorStatus) {
      return res.status(settlement.errorStatus).json({
        ok: false,
        error: { code: settlement.errorCode, message: settlement.message },
      });
    }

    return sendProviderAck(settlement.alreadyCompleted ? 'Already settled (idempotent)' : 'Settled successfully');
  } catch (err: any) {
    console.error(`[PAYMENT:WEBHOOK:ERROR] ${normGateway}:`, err.message);
    return res.status(500).json({ ok: false, error: { code: 'SETTLEMENT_ERROR', message: err.message } });
  }
}

export async function handleEasypaisaWebhook(req: Request, res: Response) {
  return processPaymentWebhook('easypaisa', req, res);
}

export async function handleJazzCashWebhook(req: Request, res: Response) {
  return processPaymentWebhook('jazzcash', req, res);
}

export async function handleGenericWebhook(req: Request, res: Response) {
  const gateway = req.params.gateway || 'unknown';
  return processPaymentWebhook(gateway, req, res);
}
