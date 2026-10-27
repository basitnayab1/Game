import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import '../data/game_catalog_api.dart';

class GamesScreen extends StatefulWidget {
  const GamesScreen({super.key});
  @override
  State<GamesScreen> createState() => _GamesScreenState();
}

class _GamesScreenState extends State<GamesScreen> {
  static const categories = <String>[
    'All', 'Hot', 'Crash', 'Slots', 'Live Casino', 'Cards',
    'Table', 'Fishing', 'Arcade', 'Sports', 'New', 'Favorites',
  ];

  late final GameCatalogApi _api;
  List<GameCatalogItem> _games = const [];
  String _selected = 'All';
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _api = GameCatalogApi(PlayerApiClient(PlayerApiClientConfig.fromEnvironment()));
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final games = await _api.fetch(category: _selected);
      if (!mounted) return;
      setState(() {
        _games = games;
        _error = null;
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'Game catalog is currently unavailable.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.home,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          backgroundColor: const Color(0xFF0B0F17),
          leading: const N5BackButton(fallbackRoute: AppRoutes.home),
          title: const Text('Games', style: TextStyle(fontWeight: FontWeight.w800)),
          actions: [
            IconButton(onPressed: () => context.push(AppRoutes.gameSearch), icon: const Icon(Icons.search_rounded)),
            IconButton(onPressed: () => context.push(AppRoutes.providerLobby), icon: const Icon(Icons.business_rounded)),
          ],
        ),
      body: Column(
        children: [
          SizedBox(
            height: 52,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final category = categories[index];
                final active = _selected == category;
                return ChoiceChip(
                  label: Text(category),
                  selected: active,
                  onSelected: (_) {
                    setState(() => _selected = category);
                    _load();
                  },
                  selectedColor: const Color(0xFF6C5CE7),
                  backgroundColor: const Color(0xFF171E2B),
                  labelStyle: TextStyle(
                    color: active ? Colors.white : const Color(0xFFA8B0C0),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                  side: const BorderSide(color: Color(0xFF293244)),
                );
              },
            ),
          ),
          Expanded(child: _buildBody(context)),
        ],
      ),
    ));
  }

  Widget _buildBody(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!, style: const TextStyle(color: Color(0xFFA8B0C0))),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }
    if (_games.isEmpty) {
      return const Center(
        child: Text('No games are currently available.', style: TextStyle(color: Color(0xFFA8B0C0))),
      );
    }
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _games.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: .92,
      ),
      itemBuilder: (context, index) {
        final game = _games[index];
        return InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => context.push(
            '${AppRoutes.gameDetail}?game=${Uri.encodeComponent(game.id)}&provider=${Uri.encodeComponent(game.providerId)}',
          ),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFF171E2B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF293244)),
            ),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.casino_rounded, size: 48, color: Color(0xFF8B7CFF)),
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Text(game.name, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(height: 5),
                  Text(game.category.toUpperCase(), style: const TextStyle(color: Color(0xFFF5C542), fontSize: 10, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
