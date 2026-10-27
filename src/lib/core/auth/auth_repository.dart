import '../networking/player_api_client.dart';

class AuthSession {
  final String accessToken;
  final String refreshToken;
  final String userId;
  final String status;

  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.userId,
    required this.status,
  });
}

class OtpChallenge {
  final String challengeId;
  final String? devCode;
  final String? antiBanLink;
  const OtpChallenge({required this.challengeId, this.devCode, this.antiBanLink});
}

class AuthRepository {
  final PlayerApiClient api;
  const AuthRepository(this.api);

  Future<AuthSession> login(String phone, String password) async {
    final response = await api.post('/auth/login', data: {
      'phone': phone,
      'password': password,
    });
    return await _saveSession(response.data);
  }

  Future<OtpChallenge> requestOtp(String phone) async {
    final response = await api.post('/auth/otp/request', data: {'phone': phone});
    final data = Map<String, dynamic>.from(response.data as Map);
    return OtpChallenge(
      challengeId: data['challengeId'] as String,
      devCode: data['devCode'] as String?,
      antiBanLink: data['antiBanLink'] as String?,
    );
  }

  Future<void> register({
    required String phone,
    required String dob,
    required String password,
  }) async {
    final response = await api.post('/auth/register', data: {
      'phone': phone,
      'dob': dob,
      'password': password,
    });
    final data = Map<String, dynamic>.from(response.data as Map);
    final challengeId = data['challengeId'] as String?;
    if (challengeId == null || challengeId.isEmpty) {
      throw StateError('Registration did not return an OTP challenge');
    }
    throw RegistrationNeedsOtp(
      challengeId: challengeId,
      devCode: data['devCode'] as String?,
      antiBanLink: data['antiBanLink'] as String?,
    );
  }

  Future<AuthSession> verifyOtp(String challengeId, String code) async {
    final response = await api.post('/auth/otp/verify', data: {
      'challengeId': challengeId,
      'code': code,
    });
    return await _saveSession(response.data);
  }

  Future<AuthSession?> checkOtpStatus(String challengeId) async {
    try {
      final response = await api.get('/auth/otp/status', queryParameters: {'challengeId': challengeId});
      final data = Map<String, dynamic>.from(response.data as Map);
      if (data['verified'] == true && data['session'] != null) {
        return await _saveSession(data['session']);
      }
    } catch (_) {}
    return null;
  }

  Future<AuthSession> refresh() async {
    final refreshToken = await api.storage.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      throw StateError('No refresh token available');
    }
    final response = await api.post('/auth/refresh', data: {
      'refreshToken': refreshToken,
    });
    return await _saveSession(response.data);
  }

  Future<void> logout() async {
    try {
      await api.post('/auth/logout');
    } finally {
      await api.storage.clearTokens();
    }
  }

  Future<AuthSession> _saveSession(dynamic raw) async {
    final data = Map<String, dynamic>.from(raw as Map);
    final accessToken = data['accessToken'] as String?;
    final refreshToken = data['refreshToken'] as String?;
    final user = data['user'] is Map
        ? Map<String, dynamic>.from(data['user'] as Map)
        : <String, dynamic>{};
    final userId = (user['id'] ?? data['userId']) as String?;

    if (accessToken == null ||
        accessToken.isEmpty ||
        refreshToken == null ||
        refreshToken.isEmpty ||
        userId == null ||
        userId.isEmpty) {
      throw const FormatException('Invalid authentication response');
    }

    final session = AuthSession(
      accessToken: accessToken,
      refreshToken: refreshToken,
      userId: userId,
      status: (user['status'] ?? 'active') as String,
    );

    await api.storage.saveTokens(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    );
    return session;
  }
}

class RegistrationNeedsOtp implements Exception {
  final String challengeId;
  final String? devCode;
  final String? antiBanLink;
  const RegistrationNeedsOtp({required this.challengeId, this.devCode, this.antiBanLink});
}
