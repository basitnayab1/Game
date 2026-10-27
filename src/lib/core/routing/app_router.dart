import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../config/app_routes.dart';
import '../../features/account_closure/presentation/account_closure_screen.dart';
import '../../features/agent/presentation/agent_dashboard_screen.dart';
import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/otp_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/faq/presentation/faq_screen.dart';
import '../../features/games/presentation/favorites_screen.dart';
import '../../features/games/presentation/game_category_screen.dart';
import '../../features/games/presentation/game_detail_screen.dart';
import '../../features/games/presentation/games_screen.dart';
import '../../features/games/presentation/provider_lobby_screen.dart';
import '../../features/games/presentation/recently_played_screen.dart';
import '../../features/games/presentation/search_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/kyc/presentation/kyc_screen.dart';
import '../../features/localization/presentation/language_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/referral/presentation/referral_screen.dart';
import '../../features/responsible_gaming/presentation/responsible_gaming_screen.dart';
import '../../features/security/presentation/security_devices_screen.dart';
import '../../features/splash/presentation/splash_screen.dart';
import '../../features/support/presentation/support_screen.dart';
import '../../features/vip/presentation/vip_center_screen.dart';
import '../../features/vip/presentation/vip_level_detail_screen.dart';
import '../../features/vip/presentation/vip_models.dart';
import '../../features/vip/presentation/vip_reward_history_screen.dart';
import '../../features/rewards/presentation/promotions_screen.dart';
import '../../features/rewards/presentation/daily_rewards_screen.dart';
import '../../features/rewards/presentation/bonus_cycles_screen.dart';
import '../../features/rewards/presentation/reward_history_screen.dart';
import '../../features/wallet/presentation/wallet_screen.dart';
import '../../features/wallet/presentation/account_statement_screen.dart';
import '../../features/wallet/presentation/deposit_screen.dart';
import '../../features/wallet/presentation/withdrawal_screen.dart';

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

final GoRouter appRouter = GoRouter(
  navigatorKey: rootNavigatorKey,
  initialLocation: AppRoutes.splash,
  routes: [
    GoRoute(path: AppRoutes.splash, builder: (_, __) => const SplashScreen()),
    GoRoute(path: AppRoutes.onboarding, builder: (_, __) => const OnboardingScreen()),
    GoRoute(path: AppRoutes.login, builder: (_, __) => const LoginScreen()),
    GoRoute(path: AppRoutes.register, builder: (_, __) => const RegisterScreen()),
    GoRoute(path: AppRoutes.otp, builder: (_, __) => const OtpScreen()),
    GoRoute(path: AppRoutes.forgotPassword, builder: (_, __) => const ForgotPasswordScreen()),
    GoRoute(path: AppRoutes.home, builder: (_, __) => const HomeScreen()),
    GoRoute(path: AppRoutes.notifications, builder: (_, __) => const NotificationsScreen()),
    GoRoute(path: AppRoutes.profile, builder: (_, __) => const ProfileScreen()),
    GoRoute(path: AppRoutes.settings, builder: (_, __) => const SettingsScreen()),
    GoRoute(path: AppRoutes.language, builder: (_, __) => const LanguageScreen()),
    GoRoute(path: AppRoutes.wallet, builder: (_, __) => const WalletScreen()),
    GoRoute(path: AppRoutes.statement, builder: (_, __) => const AccountStatementScreen()),
    GoRoute(path: AppRoutes.deposit, builder: (_, __) => const DepositScreen()),
    GoRoute(path: AppRoutes.withdrawal, builder: (_, __) => const WithdrawalScreen()),
    GoRoute(path: AppRoutes.games, builder: (_, __) => const GamesScreen()),
    GoRoute(path: AppRoutes.gameSearch, builder: (_, __) => const SearchScreen()),
    GoRoute(path: AppRoutes.gameFavorites, builder: (_, __) => const FavoritesScreen()),
    GoRoute(path: AppRoutes.gameRecent, builder: (_, __) => const RecentlyPlayedScreen()),
    GoRoute(path: AppRoutes.providerLobby, builder: (_, __) => const ProviderLobbyScreen()),
    GoRoute(path: AppRoutes.gameCategory, builder: (_, state) => GameCategoryScreen(category: state.uri.queryParameters['category'] ?? 'All')),
    GoRoute(path: AppRoutes.gameDetail, builder: (_, state) => GameDetailScreen(
      gameName: state.uri.queryParameters['game'] ?? 'Game',
      providerName: state.uri.queryParameters['provider'] ?? 'Authorized Provider',
      gameId: state.uri.queryParameters['id'] ?? state.uri.queryParameters['gameId'],
    )),
    GoRoute(path: AppRoutes.promotions, builder: (_, __) => const PromotionsScreen()),
    GoRoute(path: AppRoutes.promotionDetail, builder: (_, state) => PromotionDetailScreen(
      name: state.uri.queryParameters['name'] ?? 'Promotion',
      description: state.uri.queryParameters['description'] ?? '',
      type: state.uri.queryParameters['type'] ?? 'General',
    )),
    GoRoute(path: AppRoutes.dailyRewards, builder: (_, __) => const DailyRewardsScreen()),
    GoRoute(path: AppRoutes.bonusCycles, builder: (_, __) => const BonusCyclesScreen()),
    GoRoute(path: AppRoutes.rewardHistory, builder: (_, __) => const RewardHistoryScreen()),
    GoRoute(path: AppRoutes.vip, builder: (_, __) => const VipCenterScreen()),
    GoRoute(path: AppRoutes.vipDetail, builder: (_, state) {
      final levelNumber = int.tryParse(state.uri.queryParameters['level'] ?? '') ?? 1;
      final safeLevel = levelNumber.clamp(1, vipLevels.length).toInt();
      return VipLevelDetailScreen(level: vipLevels[safeLevel - 1]);
    }),
    GoRoute(path: AppRoutes.vipHistory, builder: (_, __) => const VipRewardHistoryScreen()),
    GoRoute(path: AppRoutes.referral, builder: (_, __) => const ReferralScreen()),
    GoRoute(path: AppRoutes.referralHistory, builder: (_, __) => const ReferralHistoryScreen()),
    GoRoute(path: AppRoutes.agent, builder: (_, __) => const AgentDashboardScreen()),
    GoRoute(path: AppRoutes.kyc, builder: (_, __) => const KycScreen()),
    GoRoute(path: AppRoutes.security, builder: (_, __) => const SecurityDevicesScreen()),
    GoRoute(path: AppRoutes.support, builder: (_, __) => const SupportScreen()),
    GoRoute(path: AppRoutes.faq, builder: (_, __) => const FaqScreen()),
    GoRoute(path: AppRoutes.responsibleGaming, builder: (_, __) => const ResponsibleGamingScreen()),
    GoRoute(path: AppRoutes.accountClosure, builder: (_, __) => const AccountClosureScreen()),
  ],
);
