import 'package:dio/dio.dart';

import '../config/app_routes.dart';
import '../networking/player_api_client.dart';

class AuthSession {
  final String accessToken;
  final String refreshToken;
  final String userId;
  final String status;

  /// True after a support reset: the player must set a new password first.
  final bool mustChangePassword;

  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.userId,
    required this.status,
    this.mustChangePassword = false,
  });

  /// Where to go after signing in.
  String get homeRoute => mustChangePassword ? AppRoutes.newPassword : AppRoutes.home;
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

  /// Creates the account and signs the player straight in.
  Future<AuthSession> register({
    required String phone,
    required String dob,
    required String password,
    String? referralCode,
    String? countryCode,
  }) async {
    final response = await api.post('/auth/register', data: {
      if (countryCode != null) 'countryCode': countryCode,
      'phone': phone,
      'dob': dob,
      'password': password,
      if (referralCode != null && referralCode.trim().isNotEmpty) 'referralCode': referralCode.trim(),
    });
    return await _saveSession(response.data);
  }

  Future<void> changePassword(String currentPassword, String newPassword) async {
    await api.post('/auth/change-password', data: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }

  /// The signed-in player's own profile.
  Future<Map<String, dynamic>> me() async {
    final response = await api.get('/users/me');
    final body = Map<String, dynamic>.from(response.data as Map);
    return Map<String, dynamic>.from(body['data'] as Map);
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
      mustChangePassword: user['mustChangePassword'] == true,
    );

    await api.storage.saveTokens(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    );
    return session;
  }
}

/// Turns a failed login or signup call into a message for the player.
String authErrorMessage(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    final body = data is Map
        ? Map<String, dynamic>.from(data)
        : const <String, dynamic>{};
    switch (body['error']) {
      case 'LOGIN_LOCKED':
        final seconds = (body['retryAfterSeconds'] as num?)?.toInt() ?? 60;
        return 'Bohat dafa ghalat password. $seconds second baad dobara koshish karein.';
      case 'LOGIN_FAILED':
        final left = (body['attemptsLeft'] as num?)?.toInt();
        return left == null
            ? 'Phone number ya password ghalat hai.'
            : 'Phone number ya password ghalat hai. $left koshish baqi.';
      case 'INVALID_REFERRAL_CODE':
        return 'Yeh referral code ghalat hai. Check karein ya khaali chhor dein.';
      case 'PHONE_ALREADY_REGISTERED':
        return 'Yeh number pehle se registered hai! 1 number par sirf 1 account ban sakta hai.';
      case 'PASSWORD_CHANGE_REQUIRED':
        return 'Pehle naya password rakhein.';
      case 'UNDERAGE':
        return 'N5 Game sirf 18 saal ya us se zyada umar ke logon ke liye hai.';
      case 'INVALID_DOB':
        return 'Date of birth sahi nahi. Calendar se dobara chunein.';
      case 'INVALID_PASSWORD':
        return 'Password kam az kam 8 characters ka hona chahiye.';
      case 'INVALID_PHONE':
        return 'Phone number sahi nahi. Dobara check karein.';
      case 'INVALID_REQUEST':
        return 'Maloomat theek se bharein.';
    }
    if (error.response == null) {
      return 'Server se rabta nahi ho saka. Internet check karein.';
    }
  }
  return 'Kuch ghalat ho gaya. Dobara koshish karein.';
}
