import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../data/game_catalog_api.dart';
import '../data/player_game_state_api.dart';
import '../../../core/networking/player_api_client.dart';

class RecentlyPlayedScreen extends StatefulWidget {
  const RecentlyPlayedScreen({super.key});
  @override
  State<RecentlyPlayedScreen> createState() => _RecentlyPlayedScreenState();
}

class _RecentlyPlayedScreenState extends State<RecentlyPlayedScreen> {
  late final Future<List<GameCatalogItem>> _future;

  @override
  void initState() {
    super.initState();
    _future = PlayerGameStateApi(
      PlayerApiClient(PlayerApiClientConfig.fromEnvironment()),
    ).recentlyPlayed();
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
          title: const Text('Recently Played', style: TextStyle(fontWeight: FontWeight.w800)),
        ),
      body: FutureBuilder<List<GameCatalogItem>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return const Center(
              child: Text('Unable to load recently played.', style: TextStyle(color: Color(0xFFA8B0C0))),
            );
          }
          final items = snapshot.data ?? const <GameCatalogItem>[];
          if (items.isEmpty) {
            return const Center(
              child: Text('No recently played games.', style: TextStyle(color: Color(0xFFA8B0C0))),
            );
          }
          return ListView.separated(
            itemCount: items.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final item = items[index];
              return ListTile(
                title: Text(item.name, style: const TextStyle(color: Colors.white)),
                subtitle: Text(item.category, style: const TextStyle(color: Color(0xFFA8B0C0))),
              );
            },
          );
        },
      ),
    ));
  }
}
