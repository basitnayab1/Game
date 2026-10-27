import 'package:dio/dio.dart';
import '../../../core/networking/player_api_client.dart';

class GameCatalogItem {
  final String id, providerId, externalGameId, name, category, status;
  final String? artworkUrl;
  final bool isHot, isNew;

  const GameCatalogItem({
    required this.id,
    required this.providerId,
    required this.externalGameId,
    required this.name,
    required this.category,
    required this.status,
    this.artworkUrl,
    required this.isHot,
    required this.isNew,
  });

  factory GameCatalogItem.fromJson(Map<String, dynamic> j) => GameCatalogItem(
    id: j['id'] as String,
    providerId: j['providerId'] as String,
    externalGameId: j['externalGameId'] as String,
    name: j['name'] as String,
    category: j['category'] as String,
    status: j['status'] as String,
    artworkUrl: j['artworkUrl'] as String?,
    isHot: j['isHot'] as bool? ?? false,
    isNew: j['isNew'] as bool? ?? false,
  );
}

class GameCatalogApi {
  final PlayerApiClient client;
  const GameCatalogApi(this.client);

  Future<List<GameCatalogItem>> fetch({String? query, String? category, String? providerId}) async {
    final r = await client.get('/games/catalog', queryParameters: {
      if (query?.trim().isNotEmpty ?? false) 'q': query!.trim(),
      if (category != null && category != 'All') 'category': category,
      if (providerId?.isNotEmpty ?? false) 'providerId': providerId,
    });
    final b = Map<String, dynamic>.from(r.data as Map);
    if (b['ok'] != true) {
      throw DioException(requestOptions: r.requestOptions, response: r, message: 'Game catalog request failed');
    }
    return (b['data'] as List)
        .map((e) => GameCatalogItem.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }
}

class GameLaunchResult {
  final String gameId;
  final String gameName;
  final String category;
  final String providerName;
  final bool isLocal;
  final String sessionId;
  final String launchUrl;
  final String expiresAt;

  const GameLaunchResult({
    required this.gameId,
    required this.gameName,
    required this.category,
    required this.providerName,
    required this.isLocal,
    required this.sessionId,
    required this.launchUrl,
    required this.expiresAt,
  });

  factory GameLaunchResult.fromJson(Map<String, dynamic> j) => GameLaunchResult(
    gameId: (j['gameId'] ?? '') as String,
    gameName: (j['gameName'] ?? '') as String,
    category: (j['category'] ?? '') as String,
    providerName: (j['providerName'] ?? '') as String,
    isLocal: (j['isLocal'] as bool?) ?? true,
    sessionId: (j['sessionId'] ?? '') as String,
    launchUrl: (j['launchUrl'] ?? '') as String,
    expiresAt: (j['expiresAt'] ?? '') as String,
  );
}

class GameLaunchApi {
  final PlayerApiClient client;
  const GameLaunchApi(this.client);

  Future<GameLaunchResult> launchGame(String gameId) async {
    final r = await client.post('/games/$gameId/launch');
    final b = Map<String, dynamic>.from(r.data as Map);
    if (b['ok'] != true) {
      final err = (b['error'] is Map)
          ? b['error']['message'] ?? 'Game launch failed'
          : 'Game launch failed';
      throw DioException(requestOptions: r.requestOptions, response: r, message: err.toString());
    }
    return GameLaunchResult.fromJson(Map<String, dynamic>.from(b['data'] as Map));
  }
}
