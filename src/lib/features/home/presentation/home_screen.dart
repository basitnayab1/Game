import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/auth_repository.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/country/country_config.dart';
import '../../../core/localization/localization_service.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import '../../../core/update/app_updater.dart';
import '../../../shared/widgets/balance_card.dart';
import '../../../shared/widgets/bottom_nav_bar.dart';
import '../../games/presentation/game_grid.dart';
import '../../wallet/data/wallet_api.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  int _navIndex = 0;

  List<(String, String, IconData)> _getCategories(BuildContext context) => [
        ('All', context.tr('all', defaultText: 'All'), Icons.apps_rounded),
        (
          'Hot',
          context.tr('hot_tag', defaultText: 'Hot'),
          Icons.local_fire_department_rounded
        ),
        (
          'Crash',
          context.tr('crash', defaultText: 'Crash'),
          Icons.bolt_rounded
        ),
        (
          'Slots',
          context.tr('slots', defaultText: 'Slots'),
          Icons.casino_rounded
        ),
        (
          'Live',
          context.tr('live_casino', defaultText: 'Live'),
          Icons.live_tv_rounded
        ),
        (
          'Cards',
          context.tr('cards', defaultText: 'Cards'),
          Icons.style_rounded
        ),
      ];

  late Future<WalletBalance> _balance = _loadBalance();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Currency follows the account's country, fixed at signup.
    AuthRepository(PlayerApiClient(PlayerApiClientConfig.fromEnvironment()))
        .me()
        .then((me) {
      CountryService.setCountryById((me['countryCode'] ?? 'PK') as String);
    }).catchError((_) {});
    // Offer a newer app version once per session.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) AppUpdater.checkOnStart(context);
    });
  }

  Future<WalletBalance> _loadBalance() =>
      WalletApi(PlayerApiClient(PlayerApiClientConfig.fromEnvironment()))
          .balance();

  /// Opens [route] and refreshes the balance when the player comes back.
  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Games open outside the app; when the player comes back, show the new balance.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      setState(() => _balance = _loadBalance());
    }
  }

  void _openAndRefresh(String route) {
    context.push(route).then((_) {
      if (mounted) setState(() => _balance = _loadBalance());
    });
  }

  @override
  Widget build(BuildContext context) {
    final categories = _getCategories(context);

    return N5LobbyBackScope(
        child: Scaffold(
      backgroundColor: const Color(0xFF0B0F17),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B0F17),
        title: const Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.all(Radius.circular(8)),
              child: Image(
                  image: AssetImage('assets/branding/n5_crown_emblem.png'),
                  width: 38,
                  height: 38,
                  fit: BoxFit.cover),
            ),
            SizedBox(width: 10),
            Text('N5 GAME',
                style:
                    TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1.5)),
          ],
        ),
        actions: [
          // Account currency: fixed by the account's country, shown only.
          ValueListenableBuilder<CountryConfig>(
            valueListenable: CountryService.countryNotifier,
            builder: (context, country, _) =>
                _headerChip(country.currencyCode, const Color(0xFFF5C542)),
          ),

          IconButton(
              onPressed: () => context.push(AppRoutes.notifications),
              icon: const Icon(Icons.notifications_none_rounded)),
          IconButton(
              onPressed: () => context.push(AppRoutes.profile),
              icon: const Icon(Icons.person_outline_rounded)),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FutureBuilder<WalletBalance>(
              future: _balance,
              builder: (context, snap) => BalanceCard(
                balance: snap.hasData
                    ? formatMinor(snap.data!.availableMinor)
                    : '--',
                currency: snap.data?.currency ?? 'PKR',
                pendingWithdrawal: (snap.data?.lockedMinor ?? 0) > 0
                    ? formatMinor(snap.data!.lockedMinor)
                    : null,
                onDeposit: () => _openAndRefresh(AppRoutes.deposit),
                onWithdraw: () => _openAndRefresh(AppRoutes.withdrawal),
              ),
            ),
            const SizedBox(height: 14),
            InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: () => _openAndRefresh(AppRoutes.dailyRewards),
              child: _welcomeCard(context),
            ),
            const SizedBox(height: 18),
            Text(
              context.tr('categories', defaultText: 'Categories'),
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 19,
                  fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 88,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: categories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (context, index) {
                  final item = categories[index];
                  return InkWell(
                    borderRadius: BorderRadius.circular(15),
                    onTap: () => context.push(
                        '${AppRoutes.gameCategory}?category=${Uri.encodeComponent(item.$1)}'),
                    child: Container(
                      width: 76,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                          color: const Color(0xFF171E2B),
                          borderRadius: BorderRadius.circular(15),
                          border: Border.all(color: const Color(0xFF293244))),
                      child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(item.$3, color: const Color(0xFF8B7CFF)),
                            const SizedBox(height: 5),
                            Text(
                              item.$2,
                              style: const TextStyle(
                                  color: Color(0xFFA8B0C0), fontSize: 11),
                              textAlign: TextAlign.center,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ]),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 18),
            Text(
              context.tr('featured_games', defaultText: 'Featured Games'),
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 19,
                  fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            const GameGrid(limit: 6, embedded: true),
          ],
        ),
      ),
      bottomNavigationBar: N5BottomNavBar(
        currentIndex: _navIndex,
        onChanged: (index) {
          if (index == 0) {
            setState(() => _navIndex = 0);
            return;
          }
          const destinations = [
            AppRoutes.home,
            AppRoutes.promotions,
            AppRoutes.referral,
            AppRoutes.support,
            AppRoutes.profile
          ];
          if (index < destinations.length) {
            context.push(destinations[index]).then((_) {
              if (mounted) setState(() => _navIndex = 0);
            });
          }
        },
      ),
    ));
  }

  Widget _headerChip(String text, Color color) => Container(
        margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 3),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFF1E2838),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFF2E3E58)),
        ),
        child: Text(text,
            style: TextStyle(
                color: color, fontSize: 11, fontWeight: FontWeight.w800)),
      );

  Widget _welcomeCard(BuildContext context) => Container(
        constraints: const BoxConstraints(minHeight: 110),
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: const LinearGradient(
              colors: [Color(0xFF24204A), Color(0xFF17253A)]),
          border: Border.all(color: const Color(0xFF293244)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              context.tr('welcome_title', defaultText: 'WELCOME TO N5'),
              style: const TextStyle(
                  color: Color(0xFFF5C542),
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2),
            ),
            const SizedBox(height: 7),
            const Row(
              children: [
                Icon(Icons.casino_outlined, color: Colors.white),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Spin the free Daily Lucky Wheel',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w700),
                  ),
                ),
                Icon(Icons.chevron_right_rounded, color: Colors.white70),
              ],
            ),
          ],
        ),
      );
}
