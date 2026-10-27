import crypto from 'node:crypto';
import { env } from '../../config/env.js';

export type PaymentMode = 'manual' | 'automatic';

export interface InitiatePaymentParams {
  mode?: PaymentMode;
  transactionId: string;
  userId: string;
  amountPkr: number;
  gateway: 'easypaisa' | 'jazzcash' | 'bank';
  payerPhone: string;
  cnicLast6?: string;
  callbackUrl?: string;
  idempotencyKey?: string;
  trxId?: string;
}

export interface PaymentInitiationResult {
  success: boolean;
  mode: PaymentMode;
  gateway: string;
  transactionId: string;
  providerReference?: string;
  paymentUrl?: string;
  ussdPromptTriggered: boolean;
  message: string;
  errorCode?: string;
}

export interface PaymentWebhookResult {
  valid: boolean;
  reason?: string;
  gateway: string;
  transactionId: string;
  providerReference: string;
  amountPkr: number;
  amountMinor: number;
  currency: string;
  status: 'completed' | 'failed';
  rawResponseCode?: string;
  signatureVerified: boolean;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Enterprise Payment Gateway Dispatcher & Security Verification
 * Native integrations for Easypaisa Open API & JazzCash MWALLET API
 */
export class PaymentGatewayService {
  /**
   * Validate standard Pakistan carrier TRX ID structure.
   */
  public static validateTrxPattern(gateway: string, trxId: string): { valid: boolean; reason?: string } {
    const clean = trxId.trim();
    if (!clean || clean.length < 4 || clean.length > 128) {
      return { valid: false, reason: 'Transaction ID must be between 4 and 128 characters.' };
    }

    if (gateway === 'easypaisa') {
      const isEasypaisaFormat = /^[0-9A-Za-z_-]{6,24}$/.test(clean);
      if (!isEasypaisaFormat) {
        return { valid: false, reason: 'Invalid Easypaisa TRX format.' };
      }
    } else if (gateway === 'jazzcash') {
      const isJazzCashFormat = /^[0-9A-Za-z_-]{6,24}$/.test(clean);
      if (!isJazzCashFormat) {
        return { valid: false, reason: 'Invalid JazzCash TID format.' };
      }
    }

    return { valid: true };
  }

  /**
   * Check whether webhook callback verification is configured and enabled for a gateway.
   * Fail-closed: returns false if keys are not configured or provider specification is unavailable.
   */
  public static isWebhookConfigured(gateway: string): boolean {
    const norm = String(gateway || '').toLowerCase().trim();
    if (norm === 'jazzcash') {
      return Boolean(process.env.JAZZCASH_WEBHOOK_SECRET || env.JAZZCASH_HASH_KEY);
    }
    if (norm === 'easypaisa') {
      return Boolean(process.env.EASYPAISA_WEBHOOK_SECRET || env.EASYPAISA_HASH_KEY);
    }
    return false;
  }

  /**
   * Compute official JazzCash HMAC-SHA256 hash (pp_SecureHash).
   * Per JazzCash Developer Guide: sorted non-empty keys (excluding pp_SecureHash) joined with '&',
   * prepended with Integrity Salt (secretKey + '&'), hashed via HMAC-SHA256, uppercased.
   */
  public static generateJazzCashSignature(payload: Record<string, any>, secretKey: string): string {
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (k !== 'pp_SecureHash' && v !== null && v !== undefined && String(v).trim() !== '') {
        filtered[k] = String(v).trim();
      }
    }
    const sortedKeys = Object.keys(filtered).sort();
    const hashString = secretKey + '&' + sortedKeys.map((k) => filtered[k]).join('&');
    return crypto.createHmac('sha256', secretKey).update(hashString).digest('hex').toUpperCase();
  }

  /**
   * Compute official Easypaisa HMAC-SHA256 signature / checksum.
   */
  public static generateEasypaisaSignature(payload: Record<string, any>, secretKey: string, rawBody?: string): string {
    if (rawBody && typeof rawBody === 'string' && rawBody.trim()) {
      return crypto.createHmac('sha256', secretKey).update(rawBody).digest('hex');
    }
    const orderRef = String(payload.orderRefNumber || payload.orderRefNum || payload.transactionId || '').trim();
    const amount = String(payload.amount || '0').trim();
    const status = String(payload.responseCode || payload.status || '').trim();
    const rawString = `${orderRef}&${amount}&${status}`;
    return crypto.createHmac('sha256', secretKey).update(rawString).digest('hex');
  }

  /**
   * Initiate direct gateway payment or register manual slip.
   * Explicitly separates manual and automatic modes. Automatic failures never silently become manual successes.
   */
  public static async initiateGatewayPayment(params: InitiatePaymentParams): Promise<PaymentInitiationResult> {
    const mode = params.mode || (params.trxId ? 'manual' : 'automatic');
    const { gateway, amountPkr, transactionId, payerPhone } = params;

    // -------------------------------------------------------------
    // A. EXPLICIT MANUAL DEPOSIT MODE
    // -------------------------------------------------------------
    if (mode === 'manual') {
      const cleanTrx = params.trxId ? String(params.trxId).trim() : '';
      if (!cleanTrx) {
        return {
          success: false,
          mode: 'manual',
          gateway,
          transactionId,
          ussdPromptTriggered: false,
          errorCode: 'TRX_REQUIRED',
          message: 'Transaction ID / TRX is required for manual deposit mode.',
        };
      }

      const patternCheck = this.validateTrxPattern(gateway, cleanTrx);
      if (!patternCheck.valid) {
        return {
          success: false,
          mode: 'manual',
          gateway,
          transactionId,
          ussdPromptTriggered: false,
          errorCode: 'INVALID_TRX_FORMAT',
          message: patternCheck.reason || 'Invalid TRX format.',
        };
      }

      return {
        success: true,
        mode: 'manual',
        gateway,
        transactionId,
        providerReference: cleanTrx,
        ussdPromptTriggered: false,
        message: `Manual deposit of PKR ${amountPkr} registered for ${gateway}. TRX: ${cleanTrx}`,
      };
    }

    // -------------------------------------------------------------
    // B. EXPLICIT AUTOMATIC GATEWAY MODE
    // -------------------------------------------------------------
    if (gateway === 'bank') {
      return {
        success: false,
        mode: 'automatic',
        gateway: 'bank',
        transactionId,
        ussdPromptTriggered: false,
        errorCode: 'AUTOMATIC_MODE_UNSUPPORTED',
        message: 'Automatic gateway dispatch is not supported for bank transfer. Use manual deposit mode.',
      };
    }

    // 1. Live Easypaisa Merchant Integration
    if (gateway === 'easypaisa') {
      if (!env.EASYPAISA_STORE_ID || !env.EASYPAISA_HASH_KEY) {
        return {
          success: false,
          mode: 'automatic',
          gateway: 'easypaisa',
          transactionId,
          ussdPromptTriggered: false,
          errorCode: 'GATEWAY_CREDENTIALS_MISSING',
          message: 'Easypaisa automatic gateway credentials not configured (integration disabled/fail-closed).',
        };
      }

      try {
        const isStaging = env.EASYPAISA_ENV !== 'production';
        const baseUrl = isStaging
          ? 'https://easypaystg.easypaisa.com.pk/easypay/Index.jsf'
          : 'https://easypay.easypaisa.com.pk/easypay/Index.jsf';

        const amountStr = amountPkr.toFixed(1);
        const orderId = (
          params.idempotencyKey
            ? crypto.createHash('sha256').update(params.idempotencyKey).digest('hex')
            : transactionId.replace(/-/g, '')
        ).slice(0, 16);
        const postBackUrl = params.callbackUrl || `https://api.n5game.com/api/v1/payments/webhook/easypaisa`;

        const rawString = `${amountStr}&${env.EASYPAISA_STORE_ID}&${orderId}&${postBackUrl}`;
        const checksum = crypto
          .createHmac('sha256', env.EASYPAISA_HASH_KEY)
          .update(rawString)
          .digest('hex');

        const checkoutUrl = `${baseUrl}?storeId=${env.EASYPAISA_STORE_ID}&amount=${amountStr}&postBackURL=${encodeURIComponent(
          postBackUrl
        )}&orderRefNum=${orderId}&encryptedHash=${checksum}&autoRedirect=1&paymentMethod=MA_PAYMENT_METHOD`;

        return {
          success: true,
          mode: 'automatic',
          gateway: 'easypaisa',
          transactionId,
          providerReference: `EP_${orderId}`,
          paymentUrl: checkoutUrl,
          ussdPromptTriggered: true,
          message: 'Easypaisa gateway initiated. Complete payment via checkout prompt.',
        };
      } catch (err: any) {
        return {
          success: false,
          mode: 'automatic',
          gateway: 'easypaisa',
          transactionId,
          ussdPromptTriggered: false,
          errorCode: 'GATEWAY_CONNECTION_ERROR',
          message: `Easypaisa gateway connection error: ${err.message}`,
        };
      }
    }

    // 2. Live JazzCash MWALLET Direct Charge API
    if (gateway === 'jazzcash') {
      if (!env.JAZZCASH_MERCHANT_ID || !env.JAZZCASH_PASSWORD || !env.JAZZCASH_HASH_KEY) {
        return {
          success: false,
          mode: 'automatic',
          gateway: 'jazzcash',
          transactionId,
          ussdPromptTriggered: false,
          errorCode: 'GATEWAY_CREDENTIALS_MISSING',
          message: 'JazzCash automatic gateway credentials not configured (integration disabled/fail-closed).',
        };
      }

      try {
        const isStaging = env.JAZZCASH_ENV !== 'production';
        const endpoint = isStaging
          ? 'https://sandbox.jazzcash.com.pk/Application/API/2.0/Purchase/DoMWalletTransaction'
          : 'https://payments.jazzcash.com.pk/Application/API/2.0/Purchase/DoMWalletTransaction';

        const txnDateTime = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const txnRefNo = `T${txnDateTime}${Math.floor(100 + Math.random() * 900)}`;
        const amountInMinor = Math.round(amountPkr * 100).toString();
        const billRef = params.idempotencyKey
          ? `N5${crypto.createHash('sha256').update(params.idempotencyKey).digest('hex').slice(0, 8).toUpperCase()}`
          : `N5${transactionId.slice(0, 8)}`;

        const payload: Record<string, string> = {
          pp_Version: '2.0',
          pp_TxnType: 'MWALLET',
          pp_Language: 'EN',
          pp_MerchantID: env.JAZZCASH_MERCHANT_ID,
          pp_Password: env.JAZZCASH_PASSWORD,
          pp_TxnRefNo: txnRefNo,
          pp_Amount: amountInMinor,
          pp_TxnCurrency: 'PKR',
          pp_TxnDateTime: txnDateTime,
          pp_BillReference: billRef,
          pp_Description: 'N5 Game Wallet Topup',
          pp_MobileNumber: payerPhone.replace(/[^\d]/g, ''),
          pp_CNIC: params.cnicLast6 || '345678',
        };

        payload.pp_SecureHash = this.generateJazzCashSignature(payload, env.JAZZCASH_HASH_KEY);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        const responseCode = data.pp_ResponseCode;

        if (responseCode === '000' || responseCode === '121') {
          return {
            success: true,
            mode: 'automatic',
            gateway: 'jazzcash',
            transactionId,
            providerReference: data.pp_TxnRefNo || txnRefNo,
            ussdPromptTriggered: true,
            message: data.pp_ResponseMessage || 'MPIN prompt sent to player handset. Enter PIN to confirm.',
          };
        } else {
          return {
            success: false,
            mode: 'automatic',
            gateway: 'jazzcash',
            transactionId,
            providerReference: data.pp_TxnRefNo || txnRefNo,
            ussdPromptTriggered: false,
            errorCode: 'GATEWAY_REJECTED',
            message: data.pp_ResponseMessage || 'JazzCash payment rejected by provider.',
          };
        }
      } catch (err: any) {
        return {
          success: false,
          mode: 'automatic',
          gateway: 'jazzcash',
          transactionId,
          ussdPromptTriggered: false,
          errorCode: 'GATEWAY_CONNECTION_ERROR',
          message: `JazzCash gateway error: ${err.message}`,
        };
      }
    }

    // Fail-closed for any unhandled gateway
    return {
      success: false,
      mode: 'automatic',
      gateway,
      transactionId,
      ussdPromptTriggered: false,
      errorCode: 'UNSUPPORTED_GATEWAY',
      message: `Automatic gateway ${gateway} is not supported. Integration disabled.`,
    };
  }

  /**
   * Strict signature verification & parsing for incoming Webhook / IPN callbacks.
   * If specification is unavailable or keys are missing, integration fails closed.
   */
  public static verifyWebhook(gateway: string, body: any, headers?: any, rawBody?: string): PaymentWebhookResult {
    const normGateway = String(gateway || '').toLowerCase().trim();

    if (normGateway === 'jazzcash') {
      return this.verifyJazzCashWebhook(body, headers, rawBody);
    }

    if (normGateway === 'easypaisa') {
      return this.verifyEasypaisaWebhook(body, headers, rawBody);
    }

    // Unspecified or unavailable gateway: fail-closed
    return {
      valid: false,
      reason: `Provider webhook specification unavailable for ${gateway}. Integration disabled (fail-closed).`,
      gateway: normGateway,
      transactionId: '',
      providerReference: '',
      amountPkr: 0,
      amountMinor: 0,
      currency: 'PKR',
      status: 'failed',
      signatureVerified: false,
    };
  }

  /**
   * Verify and parse incoming IPN / Webhook from JazzCash per official specification.
   */
  public static verifyJazzCashWebhook(body: any, _headers?: any, _rawBody?: string): PaymentWebhookResult {
    const gateway = 'jazzcash';
    const secretKey = process.env.JAZZCASH_WEBHOOK_SECRET || env.JAZZCASH_HASH_KEY;

    if (!secretKey) {
      return {
        valid: false,
        reason: 'JazzCash webhook verification key not configured (integration disabled/fail-closed).',
        gateway,
        transactionId: '',
        providerReference: '',
        amountPkr: 0,
        amountMinor: 0,
        currency: 'PKR',
        status: 'failed',
        signatureVerified: false,
      };
    }

    const payload = body || {};
    const receivedHash = String(payload.pp_SecureHash || '').trim().toUpperCase();

    if (!receivedHash) {
      return {
        valid: false,
        reason: 'Missing pp_SecureHash in JazzCash callback payload.',
        gateway,
        transactionId: '',
        providerReference: '',
        amountPkr: 0,
        amountMinor: 0,
        currency: 'PKR',
        status: 'failed',
        signatureVerified: false,
      };
    }

    const expectedHash = this.generateJazzCashSignature(payload, secretKey);
    const isValid = timingSafeEqualStr(receivedHash, expectedHash);

    if (!isValid) {
      return {
        valid: false,
        reason: 'Invalid JazzCash webhook signature (pp_SecureHash mismatch).',
        gateway,
        transactionId: String(payload.pp_BillReference || payload.transactionId || ''),
        providerReference: String(payload.pp_TxnRefNo || ''),
        amountPkr: 0,
        amountMinor: 0,
        currency: 'PKR',
        status: 'failed',
        signatureVerified: false,
      };
    }

    // Amount in JazzCash MWALLET callback is in paisas (minor units) or formatted decimal
    const rawAmount = String(payload.pp_Amount || '0');
    const amountMinor = rawAmount.includes('.')
      ? Math.round(Number(rawAmount) * 100)
      : Math.round(Number(rawAmount));
    const amountPkr = amountMinor / 100;

    const responseCode = String(payload.pp_ResponseCode || '');
    const isSuccess = responseCode === '000';
    const billRef = String(payload.pp_BillReference || '').trim();
    const txnRef = String(payload.pp_TxnRefNo || '').trim();

    return {
      valid: true,
      signatureVerified: true,
      gateway,
      transactionId: billRef || txnRef,
      providerReference: txnRef,
      amountPkr,
      amountMinor,
      currency: String(payload.pp_TxnCurrency || 'PKR').toUpperCase(),
      status: isSuccess ? 'completed' : 'failed',
      rawResponseCode: responseCode,
    };
  }

  /**
   * Verify and parse incoming IPN / Webhook from Easypaisa per official specification.
   */
  public static verifyEasypaisaWebhook(body: any, headers?: any, rawBody?: string): PaymentWebhookResult {
    const gateway = 'easypaisa';
    const secretKey = process.env.EASYPAISA_WEBHOOK_SECRET || env.EASYPAISA_HASH_KEY;

    if (!secretKey) {
      return {
        valid: false,
        reason: 'Easypaisa webhook verification key not configured (integration disabled/fail-closed).',
        gateway,
        transactionId: '',
        providerReference: '',
        amountPkr: 0,
        amountMinor: 0,
        currency: 'PKR',
        status: 'failed',
        signatureVerified: false,
      };
    }

    const payload = body || {};
    const receivedHash = String(
      payload.encryptedHash ||
      payload.checksum ||
      payload.hash ||
      headers?.['x-easypaisa-signature'] ||
      headers?.['x-signature'] ||
      ''
    ).trim().toLowerCase();

    if (!receivedHash) {
      return {
        valid: false,
        reason: 'Missing Easypaisa signature / encryptedHash in callback.',
        gateway,
        transactionId: '',
        providerReference: '',
        amountPkr: 0,
        amountMinor: 0,
        currency: 'PKR',
        status: 'failed',
        signatureVerified: false,
      };
    }

    // Try canonical formatted signature then rawBody HMAC
    const expectedCanonical = this.generateEasypaisaSignature(payload, secretKey).toLowerCase();
    let isMatch = timingSafeEqualStr(receivedHash, expectedCanonical);

    if (!isMatch && rawBody) {
      const expectedRaw = this.generateEasypaisaSignature(payload, secretKey, rawBody).toLowerCase();
      isMatch = timingSafeEqualStr(receivedHash, expectedRaw);
    }

    // Also support Easypay store-salted format: HMAC(amount&storeId&orderRefNum&postBackURL)
    if (!isMatch && env.EASYPAISA_STORE_ID) {
      const orderRef = String(payload.orderRefNumber || payload.orderRefNum || payload.transactionId || '').trim();
      const amountStr = Number(payload.amount || 0).toFixed(1);
      const postBack = String(payload.postBackURL || payload.postBackUrl || '').trim();
      const altString = `${amountStr}&${env.EASYPAISA_STORE_ID}&${orderRef}&${postBack}`;
      const altHash = crypto.createHmac('sha256', secretKey).update(altString).digest('hex').toLowerCase();
      isMatch = timingSafeEqualStr(receivedHash, altHash);
    }

    if (!isMatch) {
      return {
        valid: false,
        reason: 'Invalid Easypaisa signature / checksum mismatch.',
        gateway,
        transactionId: String(payload.orderRefNumber || payload.orderRefNum || ''),
        providerReference: String(payload.transactionId || payload.trxId || ''),
        amountPkr: 0,
        amountMinor: 0,
        currency: 'PKR',
        status: 'failed',
        signatureVerified: false,
      };
    }

    const amountPkr = Number(payload.amount || 0);
    const amountMinor = Math.round(amountPkr * 100);
    const responseCode = String(payload.responseCode || payload.status || '');
    const isSuccess = responseCode === '0000' || responseCode === '000' || responseCode === 'PAID' || responseCode === 'SUCCESS';
    const orderRef = String(payload.orderRefNumber || payload.orderRefNum || payload.transactionId || '').trim();
    const trxId = String(payload.transactionId || payload.trxId || `EP_${orderRef}`).trim();

    return {
      valid: true,
      signatureVerified: true,
      gateway,
      transactionId: orderRef,
      providerReference: trxId,
      amountPkr,
      amountMinor,
      currency: 'PKR',
      status: isSuccess ? 'completed' : 'failed',
      rawResponseCode: responseCode,
    };
  }
}


