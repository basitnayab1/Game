import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from '../modules/auth/routes.js';
import { usersRouter } from '../modules/users/routes.js';
import { requireAuth } from '../middleware/auth.js';
import { getMyWallet } from '../modules/wallet/wallet.controller.js';
import { getMyAccountStatement } from '../modules/transactions/account-statement.controller.js';
import { getGameCatalogController } from '../modules/games/catalog.controller.js';
import { listFavorites, updateFavorite, listRecentlyPlayed } from '../modules/games/player-state.controller.js';
import { getGameDetail } from '../modules/games/game-detail.controller.js';
import { launchGame } from '../modules/games/game-launch.controller.js';
import { receiveGameProviderEvent } from '../modules/games/provider-event.controller.js';
import {
  placeCrashBet,
  cashoutCrashBet,
  getCrashRoundStatus,
  verifyCrashFairnessController,
} from '../modules/games/crash-game.controller.js';
import {
  spinGameController,
  claimTestBalanceController,
} from '../modules/games/game-play.controller.js';
import { getPromotions, activatePromotion, openPromotion, getCycles, openCycle } from '../modules/rewards/rewards.controller.js';
import { getVip, getVipLevel, getVipHistory } from '../modules/vip_referral/vip.controller.js';
import { getReferral, getReferralHistory } from '../modules/referral/referral.controller.js';
import { getAgent, applyAgent } from '../modules/agent/agent.controller.js';
import { getKyc, submitKyc, handleKycWebhook, getSecurity, revokeOthers } from '../modules/security_kyc/integration.controller.js';
import { getNotifications, readNotification, readAllNotifications, getTickets, getTicket, createTicket, postTicketMessage } from '../modules/support_notifications/controller.js';
import { getSettings, updateSettings } from '../modules/settings/settings.controller.js';
import { getResponsibleGaming, updateResponsibleGaming } from '../modules/responsibleGaming/player.controller.js';
import { getClosure, requestClosure, cancelClosure } from '../modules/accountClosure/account-closure.controller.js';
import { listAdminConfig, updateAdminConfig } from '../modules/admin/admin.controller.js';
import { requireAdmin } from '../modules/admin/admin-access.middleware.js';
import { adminOverview, adminUsers, adminUserDetail, adminKycReview, adminRiskUpdate, adminSupport, adminSupportDetail, adminSupportStatus } from '../modules/admin/admin-operations.controller.js';
import { adminProviders, adminGames, adminProviderUpdate, adminGameUpdate } from '../modules/admin/admin-games.controller.js';
import { adminPromotions, adminPromotionUpsert, adminRewardConfigs, adminRewardConfigUpsert } from '../modules/admin/admin-promotions.controller.js';
import { adminVipLevels, adminVipLevelUpdate } from '../modules/admin/admin-vip.controller.js';
import { createCashierRouter } from '../modules/payments/cashier.routes.js';
import { createAdminFinancialRouter } from '../modules/admin/admin-financial.routes.js';

/**
 * Canonical API router. Only endpoints with an implemented/authenticated
 * controller are mounted here. Financial/provider mutations stay gated
 * until their production repository/provider contracts are connected.
 */
export function createApiRouter() {
  const router = Router();

  router.use('/health', healthRouter);
  router.use('/auth', authRouter);
  router.use('/users', usersRouter);

  // Authenticated read-only wallet boundary. The controller fails closed
  // with 503 until the production DB repository is configured.
  router.get('/wallet', requireAuth, getMyWallet);
  router.get('/wallet/statement', requireAuth, getMyAccountStatement);
  router.get('/promotions', requireAuth, getPromotions);
  router.post('/promotions/:promotionId/activate', requireAuth, activatePromotion);
  router.post('/promotions/:promotionId/open', requireAuth, openPromotion);
  router.get('/rewards/cycles', requireAuth, getCycles);
  router.post('/rewards/cycles/:cycleId/open', requireAuth, openCycle);
  router.get('/vip', requireAuth, getVip);
  router.get('/vip/levels/:level', requireAuth, getVipLevel);
  router.get('/vip/rewards', requireAuth, getVipHistory);
  router.get('/referral', requireAuth, getReferral);
  router.get('/referral/history', requireAuth, getReferralHistory);
  router.get('/agent', requireAuth, getAgent);
  router.post('/agent/apply', requireAuth, applyAgent);
  router.get('/kyc', requireAuth, getKyc);
  router.post('/kyc/submit', requireAuth, submitKyc);
  // Provider callbacks are unauthenticated; handleKycWebhook verifies the provider signature over the raw body.
  router.post('/kyc/webhook/:provider', handleKycWebhook);
  router.get('/security/overview', requireAuth, getSecurity);
  router.post('/security/sessions/revoke-others', requireAuth, revokeOthers);
  router.get('/notifications', requireAuth, getNotifications);
  router.post('/notifications/:id/read', requireAuth, readNotification);
  router.post('/notifications/read-all', requireAuth, readAllNotifications);
  router.get('/support/tickets', requireAuth, getTickets);
  router.post('/support/tickets', requireAuth, createTicket);
  router.get('/support/tickets/:id', requireAuth, getTicket);
  router.post('/support/tickets/:id/messages', requireAuth, postTicketMessage);
  router.get('/settings', requireAuth, getSettings);
  router.patch('/settings', requireAuth, updateSettings);
  router.get('/responsible-gaming', requireAuth, getResponsibleGaming);
  router.patch('/responsible-gaming', requireAuth, updateResponsibleGaming);
  router.get('/account-closure', requireAuth, getClosure);
  router.post('/account-closure', requireAuth, requestClosure);
  router.post('/account-closure/cancel', requireAuth, cancelClosure);
  router.get('/admin/config', requireAuth, requireAdmin, listAdminConfig);
  router.patch('/admin/config', requireAuth, requireAdmin, updateAdminConfig);
  router.get('/admin/overview', requireAuth, requireAdmin, adminOverview);
  router.get('/admin/users', requireAuth, requireAdmin, adminUsers);
  router.get('/admin/users/:userId', requireAuth, requireAdmin, adminUserDetail);
  router.patch('/admin/users/:userId/kyc', requireAuth, requireAdmin, adminKycReview);
  router.patch('/admin/risk/:flagId', requireAuth, requireAdmin, adminRiskUpdate);
  router.get('/admin/support/tickets', requireAuth, requireAdmin, adminSupport);
  router.get('/admin/support/tickets/:ticketId', requireAuth, requireAdmin, adminSupportDetail);
  router.patch('/admin/support/tickets/:ticketId/status', requireAuth, requireAdmin, adminSupportStatus);
  router.get('/admin/providers', requireAuth, requireAdmin, adminProviders);
  router.get('/admin/games', requireAuth, requireAdmin, adminGames);
  router.patch('/admin/providers/:providerId', requireAuth, requireAdmin, adminProviderUpdate);
  router.patch('/admin/games/:gameId', requireAuth, requireAdmin, adminGameUpdate);
  router.get('/admin/promotions', requireAuth, requireAdmin, adminPromotions);
  router.put('/admin/promotions', requireAuth, requireAdmin, adminPromotionUpsert);
  router.get('/admin/reward-configs', requireAuth, requireAdmin, adminRewardConfigs);
  router.put('/admin/reward-configs', requireAuth, requireAdmin, adminRewardConfigUpsert);
  router.get('/admin/vip/levels', requireAuth, requireAdmin, adminVipLevels);
  router.patch('/admin/vip/levels/:level', requireAuth, requireAdmin, adminVipLevelUpdate);

  // Modular Cashier & Admin Financial Management
  router.use('/payments', createCashierRouter());
  router.use('/admin', createAdminFinancialRouter());

  router.get('/games/catalog', requireAuth, getGameCatalogController);
  router.get('/games/favorites', requireAuth, listFavorites);
  router.put('/games/favorites/:gameId', requireAuth, updateFavorite);
  router.delete('/games/favorites/:gameId', requireAuth, updateFavorite);
  router.get('/games/recently-played', requireAuth, listRecentlyPlayed);
  router.get('/games/:gameId', requireAuth, getGameDetail);
  router.post('/games/:gameId/launch', requireAuth, launchGame);
  // Provider callbacks require raw-body capture + signature verification; they never mutate wallet/ledger directly.
  router.post('/webhooks/games/:provider', receiveGameProviderEvent);

  // Crash and Slot game routes
  router.post('/games/crash/bet', requireAuth, placeCrashBet);
  router.post('/games/crash/cashout', requireAuth, cashoutCrashBet);
  router.get('/games/crash/rounds/:roundId', requireAuth, getCrashRoundStatus);
  router.post('/games/crash/verify', verifyCrashFairnessController);
  router.post('/games/play/spin', requireAuth, spinGameController);
  router.post('/games/spin', requireAuth, spinGameController);
  if (process.env.NODE_ENV !== 'production') {
    router.post('/games/play/faucet', requireAuth, claimTestBalanceController);
    router.post('/games/faucet', requireAuth, claimTestBalanceController);
  }

  router.use((_req, res) => {
    res.status(404).json({
      ok: false,
      error: { code: 'ROUTE_NOT_FOUND', message: 'API route not found' },
    });
  });

  return router;
}
