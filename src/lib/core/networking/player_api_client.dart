import 'dart:async';
import 'dart:math';

import 'package:dio/dio.dart';

import '../storage/secure_storage.dart';

class PlayerApiClientConfig {
  final String baseUrl;
  final List<String> candidateUrls;

  const PlayerApiClientConfig({
    required this.baseUrl,
    this.candidateUrls = const [],
  });

  static String? _activeBaseUrl;

  static void setActiveBaseUrl(String url) {
    _activeBaseUrl = url.trim().replaceFirst(RegExp(r'/+$'), '');
  }

  static String get currentBaseUrl {
    if (_activeBaseUrl != null && _activeBaseUrl!.isNotEmpty) {
      return _activeBaseUrl!;
    }
    const envUrl = String.fromEnvironment('N5_API_BASE_URL');
    if (envUrl.isNotEmpty) {
      return envUrl;
    }
    return 'https://payroll-petition-missile-feeling.trycloudflare.com/api/v1';
  }

  factory PlayerApiClientConfig.fromEnvironment() {
    final active = currentBaseUrl;
    const defaultCandidates = [
      'https://payroll-petition-missile-feeling.trycloudflare.com/api/v1',
      'http://192.168.18.7:8080/api/v1',
      'http://10.0.2.2:8080/api/v1',
      'http://127.0.0.1:8080/api/v1',
    ];
    final ordered = [
      active,
      ...defaultCandidates.where((c) => c != active),
    ];
    return PlayerApiClientConfig(
      baseUrl: active,
      candidateUrls: ordered,
    );
  }
}

/// Marks a request as a financial mutation. These requests must never be
/// automatically replayed after an authentication refresh because the server
/// may already have accepted the original mutation.
const String n5FinancialMutation = 'n5FinancialMutation';

/// Marks a request as safe to retry once after a successful token refresh.
const String n5SafeRetry = 'n5SafeRetry';

class PlayerApiClient {
  final PlayerApiClientConfig config;
  final SecureStorage _storage;
  late final Dio _dio;
  Future<bool>? _refreshFuture;

  PlayerApiClient(this.config, {SecureStorage? storage})
      : _storage = storage ?? const SecureStorage() {
    _dio = Dio(
      BaseOptions(
        baseUrl: config.baseUrl.replaceFirst(RegExp(r'/+$'), ''),
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 20),
        sendTimeout: const Duration(seconds: 20),
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (options.baseUrl.isEmpty || options.baseUrl.contains('example.invalid')) {
            options.baseUrl = PlayerApiClientConfig.currentBaseUrl;
          }
          final token = await _storage.readAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          options.headers.putIfAbsent('X-Request-ID', () => _requestId());
          handler.next(options);
        },
        onError: (error, handler) async {
          final request = error.requestOptions;
          final isConnError = error.type == DioExceptionType.connectionError ||
              error.type == DioExceptionType.connectionTimeout;

          // If connection fails due to host resolution or offline route, try fallback candidates
          if (isConnError && config.candidateUrls.isNotEmpty) {
            final tried = (request.extra['n5TriedUrls'] as List<String>?) ?? <String>[request.baseUrl];
            for (final candidate in config.candidateUrls) {
              final clean = candidate.replaceFirst(RegExp(r'/+$'), '');
              if (!tried.contains(clean)) {
                tried.add(clean);
                request.extra['n5TriedUrls'] = tried;
                request.baseUrl = clean;
                PlayerApiClientConfig.setActiveBaseUrl(clean);
                _dio.options.baseUrl = clean;
                try {
                  final retryResponse = await _dio.fetch(request);
                  handler.resolve(retryResponse);
                  return;
                } catch (_) {
                  // Continue to next candidate
                }
              }
            }
          }

          final isUnauthorized = error.response?.statusCode == 401;
          final isRefreshRequest = request.path.endsWith('/auth/refresh');
          final alreadyRetried = request.extra['n5Retried'] == true;
          final isFinancial = request.extra[n5FinancialMutation] == true;
          final isSafeRetry = request.extra[n5SafeRetry] == true;
          final method = request.method.toUpperCase();
          final readOnlyMethod = method == 'GET' || method == 'HEAD' || method == 'OPTIONS';

          // Never replay mutations. Even a caller accidentally marking a POST
          // as safe cannot turn it into an automatic retry.
          if (!isUnauthorized ||
              isRefreshRequest ||
              alreadyRetried ||
              isFinancial ||
              !isSafeRetry ||
              !readOnlyMethod) {
            handler.next(error);
            return;
          }

          final refreshed = await _refreshAccessToken();
          if (!refreshed) {
            await _storage.clearTokens();
            handler.next(error);
            return;
          }

          try {
            final accessToken = await _storage.readAccessToken();
            if (accessToken == null || accessToken.isEmpty) {
              handler.next(error);
              return;
            }
            request.extra['n5Retried'] = true;
            request.headers['Authorization'] = 'Bearer $accessToken';
            final retryResponse = await _dio.fetch(request);
            handler.resolve(retryResponse);
          } catch (_) {
            handler.next(error);
          }
        },
      ),
    );
  }

  String _requestId() {
    final now = DateTime.now().microsecondsSinceEpoch;
    final random = Random().nextInt(1 << 32).toRadixString(16);
    return 'n5-$now-$random';
  }

  Future<bool> _refreshAccessToken() {
    final existing = _refreshFuture;
    if (existing != null) return existing;

    final future = _performRefresh();
    _refreshFuture = future;
    future.whenComplete(() {
      if (identical(_refreshFuture, future)) {
        _refreshFuture = null;
      }
    });
    return future;
  }

  Future<bool> _performRefresh() async {
    final refreshToken = await _storage.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) return false;

    try {
      final response = await _dio.post(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
        options: Options(extra: {'skipAuthRefresh': true}),
      );
      final data = Map<String, dynamic>.from(response.data as Map);
      final accessToken = data['accessToken'] as String?;
      final newRefreshToken = data['refreshToken'] as String?;
      if (accessToken == null ||
          accessToken.isEmpty ||
          newRefreshToken == null ||
          newRefreshToken.isEmpty) {
        return false;
      }
      await _storage.saveTokens(
        accessToken: accessToken,
        refreshToken: newRefreshToken,
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  String endpoint(String path) {
    final cleanBase = PlayerApiClientConfig.currentBaseUrl.replaceFirst(RegExp(r'/+$'), '');
    final cleanPath = path.replaceFirst(RegExp(r'^/+'), '');
    return '$cleanBase/$cleanPath';
  }

  SecureStorage get storage => _storage;

  Future<Response<dynamic>> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) =>
      _dio.get(path, queryParameters: queryParameters, options: options);

  Future<Response<dynamic>> post(
    String path, {
    Object? data,
    Options? options,
  }) =>
      _dio.post(path, data: data, options: options);

  Future<Response<dynamic>> put(
    String path, {
    Object? data,
    Options? options,
  }) =>
      _dio.put(path, data: data, options: options);

  Future<Response<dynamic>> delete(String path, {Options? options}) =>
      _dio.delete(path, options: options);
}
