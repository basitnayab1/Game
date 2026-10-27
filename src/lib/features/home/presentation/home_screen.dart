import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/country/country_config.dart';
import '../../../core/country/country_picker_sheet.dart';
import '../../../core/localization/localization_service.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../shared/widgets/balance_card.dart';
import '../../../shared/widgets/bottom_nav_bar.dart';
import '../../localization/presentation/language_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _navIndex = 0;

  List<(String, String, IconData)> _getCategories(BuildContext context) => [
    ('All', context.tr('all', defaultText: 'All'), Icons.apps_rounded),
    ('Hot', context.tr('hot_tag', defaultText: 'Hot'), Icons.local_fire_department_rounded),
    ('Crash', context.tr('crash', defaultText: 'Crash'), Icons.bolt_rounded),
    ('Slots', context.tr('slots', defaultText: 'Slots'), Icons.casino_rounded),
    ('Live', context.tr('live_casino', defaultText: 'Live'), Icons.live_tv_rounded),
    ('Cards', context.tr('cards', defaultText: 'Cards'), Icons.style_rounded),
  ];

  static const games = <(String, IconData, String)>[
    ('Featured Game', Icons.stars_rounded, 'FEATURED'),
    ('Popular Game', Icons.local_fire_department_rounded, 'HOT'),
    ('New Game', Icons.new_releases_rounded, 'NEW'),
    ('Live Table', Icons.table_bar_rounded, 'LIVE'),
  ];

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
              child: Image(image: AssetImage('assets/branding/n5_crown_emblem.png'), width: 38, height: 38, fit: BoxFit.cover),
            ),
            SizedBox(width: 10),
            Text('N5 GAME', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1.5)),
          ],
        ),
        actions: [
          // Country Selector Chip
          ValueListenableBuilder<CountryConfig>(
            valueListenable: CountryService.countryNotifier,
            builder: (context, country, _) => InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => showCountryPickerSheet(context),
              child: Container(
                margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 3),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E2838),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFF2E3E58)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(country.flag, style: const TextStyle(fontSize: 15)),
                    const SizedBox(width: 4),
                    Text(
                      country.currencyCode,
                      style: const TextStyle(
                        color: Color(0xFFF5C542),
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Language Selector Chip
          ValueListenableBuilder<AppLanguage>(
            valueListenable: LocalizationService.languageNotifier,
            builder: (context, lang, _) => InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => showLanguagePickerSheet(context),
              child: Container(
                margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 3),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E2838),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFF2E3E58)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(lang.flag, style: const TextStyle(fontSize: 14)),
                    const SizedBox(width: 4),
                    Text(
                      lang.code.toUpperCase(),
                      style: const TextStyle(
                        color: Color(0xFF8B7CFF),
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          IconButton(onPressed: () => context.push(AppRoutes.notifications), icon: const Icon(Icons.notifications_none_rounded)),
          IconButton(onPressed: () => context.push(AppRoutes.profile), icon: const Icon(Icons.person_outline_rounded)),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            BalanceCard(
              balance: '0.00',
              onDeposit: () => context.push(AppRoutes.deposit),
              onWithdraw: () => context.push(AppRoutes.withdrawal),
            ),
            const SizedBox(height: 14),
            _welcomeCard(context),
            const SizedBox(height: 18),
            Text(
              context.tr('categories', defaultText: 'Categories'),
              style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800),
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
                    onTap: () => context.push('${AppRoutes.gameCategory}?category=${Uri.encodeComponent(item.$1)}'),
                    child: Container(
                      width: 76,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(color: const Color(0xFF171E2B), borderRadius: BorderRadius.circular(15), border: Border.all(color: const Color(0xFF293244))),
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Icon(item.$3, color: const Color(0xFF8B7CFF)),
                        const SizedBox(height: 5),
                        Text(
                          item.$2,
                          style: const TextStyle(color: Color(0xFFA8B0C0), fontSize: 11),
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
              style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: games.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: .95),
              itemBuilder: (context, index) {
                final game = games[index];
                return InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => context.push('${AppRoutes.gameDetail}?game=${Uri.encodeComponent(game.$1)}'),
                  child: Container(
                    decoration: BoxDecoration(color: const Color(0xFF171E2B), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFF293244))),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(game.$2, size: 48, color: const Color(0xFF8B7CFF)),
                      const SizedBox(height: 10),
                      Text(game.$1, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 5),
                      Text(game.$3, style: const TextStyle(color: Color(0xFFF5C542), fontSize: 11, fontWeight: FontWeight.w700)),
                    ]),
                  ),
                );
              },
            ),
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
          const destinations = [AppRoutes.home, AppRoutes.promotions, AppRoutes.referral, AppRoutes.support, AppRoutes.profile];
          if (index < destinations.length) {
            context.push(destinations[index]).then((_) {
              if (mounted) setState(() => _navIndex = 0);
            });
          }
        },
      ),
    ));
  }

  Widget _welcomeCard(BuildContext context) => Container(
    constraints: const BoxConstraints(minHeight: 110),
    width: double.infinity,
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(18),
      gradient: const LinearGradient(colors: [Color(0xFF24204A), Color(0xFF17253A)]),
      border: Border.all(color: const Color(0xFF293244)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          context.tr('welcome_title', defaultText: 'WELCOME TO N5'),
          style: const TextStyle(color: Color(0xFFF5C542), fontWeight: FontWeight.w800, letterSpacing: 1.2),
        ),
        const SizedBox(height: 7),
        Text(
          context.tr('welcome_subtitle', defaultText: 'Discover games, promotions and rewards'),
          style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700),
        ),
      ],
    ),
  );
}
