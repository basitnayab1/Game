import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/networking/player_api_client.dart';
import '../data/game_catalog_api.dart';

/// Opens the detail screen for a catalog game, carrying the id the launch call needs.
void openGame(BuildContext context, GameCatalogItem game) {
  context.push(
    '${AppRoutes.gameDetail}?id=${Uri.encodeComponent(game.id)}'
    '&game=${Uri.encodeComponent(game.name)}&provider=${Uri.encodeComponent(game.category)}',
  );
}

IconData gameIcon(String category) {
  final c = category.toLowerCase();
  if (c.contains('crash')) return Icons.flight_takeoff_rounded;
  if (c.contains('slot')) return Icons.casino_rounded;
  if (c.contains('live')) return Icons.live_tv_rounded;
  if (c.contains('card')) return Icons.style_rounded;
  return Icons.sports_esports_rounded;
}

/// A grid of real games from the server catalog.
class GameGrid extends StatefulWidget {
  final String? category;
  final String? query;
  final int? limit;

  /// When true the grid sizes itself to its content (for use inside another scroll view).
  final bool embedded;

  const GameGrid({super.key, this.category, this.query, this.limit, this.embedded = false});

  @override
  State<GameGrid> createState() => _GameGridState();
}

class _GameGridState extends State<GameGrid> {
  final _api = GameCatalogApi(PlayerApiClient(PlayerApiClientConfig.fromEnvironment()));
  late Future<List<GameCatalogItem>> _future = _load();

  Future<List<GameCatalogItem>> _load() async {
    // "Hot" is a flag on games, not a catalog category.
    final hot = widget.category == 'Hot';
    final games = await _api.fetch(category: hot ? null : widget.category, query: widget.query);
    final filtered = hot ? games.where((g) => g.isHot).toList() : games;
    return widget.limit == null ? filtered : filtered.take(widget.limit!).toList();
  }

  @override
  void didUpdateWidget(GameGrid old) {
    super.didUpdateWidget(old);
    if (old.category != widget.category || old.query != widget.query) {
      _future = _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<GameCatalogItem>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Padding(
            padding: EdgeInsets.all(32),
            child: Center(child: CircularProgressIndicator()),
          );
        }
        if (snap.hasError) {
          return _message('Games could not be loaded.', retry: true);
        }
        final games = snap.data!;
        if (games.isEmpty) return _message('No games here yet.');
        return GridView.builder(
          shrinkWrap: widget.embedded,
          physics: widget.embedded ? const NeverScrollableScrollPhysics() : null,
          padding: widget.embedded ? EdgeInsets.zero : const EdgeInsets.all(16),
          itemCount: games.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: .95,
          ),
          itemBuilder: (context, index) => _tile(context, games[index]),
        );
      },
    );
  }

  Widget _message(String text, {bool retry = false}) => Padding(
        padding: const EdgeInsets.all(32),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(text, style: const TextStyle(color: Color(0xFFA8B0C0))),
              if (retry)
                TextButton(
                  onPressed: () => setState(() => _future = _load()),
                  child: const Text('Retry'),
                ),
            ],
          ),
        ),
      );

  Widget _tile(BuildContext context, GameCatalogItem game) {
    final tag = game.isHot ? 'HOT' : (game.isNew ? 'NEW' : game.category.toUpperCase());
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => openGame(context, game),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF171E2B),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF293244)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(gameIcon(game.category), size: 48, color: const Color(0xFF8B7CFF)),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                game.name,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(height: 5),
            Text(tag, style: const TextStyle(color: Color(0xFFF5C542), fontSize: 11, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}
