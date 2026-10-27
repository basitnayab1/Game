import 'package:flutter/material.dart';

import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import '../data/game_catalog_api.dart';
import '../data/player_game_state_api.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  late final PlayerGameStateApi _api;
  late Future<List<GameCatalogItem>> _future;

  @override
  void initState() {
    super.initState();
    _api = PlayerGameStateApi(
      PlayerApiClient(PlayerApiClientConfig.fromEnvironment()),
    );
    _future = _api.favorites();
  }

  void _retry() {
    setState(() => _future = _api.favorites());
  }

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.home,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.home),
          title: const Text('Favorites'),
        ),
      body: FutureBuilder<List<GameCatalogItem>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: ElevatedButton(
                onPressed: _retry,
                child: const Text('Retry'),
              ),
            );
          }
          final items = snapshot.data ?? const <GameCatalogItem>[];
          if (items.isEmpty) {
            return const Center(child: Text('No favorite games yet.'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final game = items[index];
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.favorite),
                  title: Text(game.name),
                  subtitle: Text('${game.category} • ${game.status}'),
                ),
              );
            },
          );
        },
      ),
    ));
  }
}
