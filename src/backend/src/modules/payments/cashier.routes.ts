import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getPublicPaymentConfig } from '../admin/admin-payment-methods.controller.js';
import {
  requestDeposit,
  requestWithdrawal,
  getPaymentHistory,
  handleEasypaisaWebhook,
  handleJazzCashWebhook,
  handleGenericWebhook,
} from './cashier.controller.js';

export function createCashierRouter(): Router {
  const router = Router();

  router.get('/config', getPublicPaymentConfig);
  router.post('/deposits', requireAuth, requestDeposit);
  router.post('/withdrawals', requireAuth, requestWithdrawal);
  router.get('/history', requireAuth, getPaymentHistory);

  // Dedicated and parameterized Webhook / IPN callback routes
  router.post('/webhook/easypaisa', handleEasypaisaWebhook);
  router.get('/webhook/easypaisa', handleEasypaisaWebhook);
  router.post('/webhook/jazzcash', handleJazzCashWebhook);
  router.get('/webhook/jazzcash', handleJazzCashWebhook);
  router.post('/webhook/:gateway', handleGenericWebhook);
  router.get('/webhook/:gateway', handleGenericWebhook);

  return router;
}
