import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from './admin-access.middleware.js';
import {
  listAdminDeposits,
  approveDeposit,
  rejectDeposit,
  listAdminWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  recordWithdrawalPayoutSuccess,
  recordWithdrawalPayoutFailure,
} from './admin-financial.controller.js';
import {
  listAdminPaymentMethods,
  createAdminPaymentMethod,
  updateAdminPaymentMethod,
  deleteAdminPaymentMethod,
} from './admin-payment-methods.controller.js';
import {
  adminUserStatusUpdate,
  adminUserBalanceAdjust,
} from './admin-operations.controller.js';

export function createAdminFinancialRouter(): Router {
  const router = Router();

  // Admin Financial Management (Deposits & Withdrawals Approval)
  router.get('/deposits', requireAuth, requireAdmin, listAdminDeposits);
  router.post('/deposits/:id/approve', requireAuth, requireAdmin, approveDeposit);
  router.post('/deposits/:id/reject', requireAuth, requireAdmin, rejectDeposit);
  router.get('/withdrawals', requireAuth, requireAdmin, listAdminWithdrawals);
  router.post('/withdrawals/:id/approve', requireAuth, requireAdmin, approveWithdrawal);
  router.post('/withdrawals/:id/reject', requireAuth, requireAdmin, rejectWithdrawal);
  router.post('/withdrawals/:id/payout-success', requireAuth, requireAdmin, recordWithdrawalPayoutSuccess);
  router.post('/withdrawals/:id/payout-failure', requireAuth, requireAdmin, recordWithdrawalPayoutFailure);

  // Admin Payment Methods Management
  router.get('/payment-methods', requireAuth, requireAdmin, listAdminPaymentMethods);
  router.post('/payment-methods', requireAuth, requireAdmin, createAdminPaymentMethod);
  router.put('/payment-methods/:id', requireAuth, requireAdmin, updateAdminPaymentMethod);
  router.delete('/payment-methods/:id', requireAuth, requireAdmin, deleteAdminPaymentMethod);

  // Admin User Moderation & Balance Adjustments
  router.post('/users/:userId/status', requireAuth, requireAdmin, adminUserStatusUpdate);
  router.post('/users/:userId/adjust-balance', requireAuth, requireAdmin, adminUserBalanceAdjust);

  return router;
}
