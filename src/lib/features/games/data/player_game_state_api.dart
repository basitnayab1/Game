import '../../../core/networking/player_api_client.dart';
import 'game_catalog_api.dart';

class PlayerGameStateApi {
  final PlayerApiClient client;
  const PlayerGameStateApi(this.client);

  Future<List<GameCatalogItem>> favorites() => _list('/games/favorites');
  Future<List<GameCatalogItem>> recentlyPlayed() => _list('/games/recently-played');

  Future<void> setFavorite(String gameId, bool value) async {
    if (value) { await client.put('/games/favorites/$gameId'); }
    else { await client.delete('/games/favorites/$gameId'); }
  }

  Future<List<GameCatalogItem>> _list(String path) async {
    final r = await client.get(path);
    final b = Map<String, dynamic>.from(r.data as Map);
    if (b['ok'] != true) throw Exception('Game state request failed');
    return (b['data'] as List).map((e) => GameCatalogItem.fromJson(Map<String,dynamic>.from(e as Map))).toList();
  }
}
