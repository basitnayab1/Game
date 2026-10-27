class GameLaunchContext {
  final String gameId;
  final String providerId;
  final String launchUrl;
  final DateTime expiresAt;
  const GameLaunchContext({required this.gameId, required this.providerId, required this.launchUrl, required this.expiresAt});

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}

void requireLaunchable(GameLaunchContext context) {
  if (context.gameId.trim().isEmpty || context.providerId.trim().isEmpty || context.launchUrl.trim().isEmpty) {
    throw StateError('Invalid game launch context');
  }
  if (context.isExpired) throw StateError('Game launch session expired');
}
