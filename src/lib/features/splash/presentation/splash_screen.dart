import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../../core/auth/auth_repository.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/networking/player_api_client.dart';
import '../../../core/storage/secure_storage.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    final destination = _startRoute();
    _timer = Timer(const Duration(seconds: 2), () async {
      final route = await destination;
      if (!mounted) return;
      context.go(route);
    });
  }

  /// A signed-in player goes straight to the lobby; everyone else sees onboarding.
  Future<String> _startRoute() async {
    try {
      final refresh = await const SecureStorage().readRefreshToken();
      if (refresh == null || refresh.isEmpty) return AppRoutes.onboarding;
      final session = await AuthRepository(PlayerApiClient(PlayerApiClientConfig.fromEnvironment())).refresh();
      return session.homeRoute;
    } on DioException catch (e) {
      // Offline or server busy: keep the session and let the lobby retry.
      if (e.response?.statusCode != 401) return AppRoutes.home;
      await const SecureStorage().clearTokens();
      return AppRoutes.login;
    } catch (_) {
      return AppRoutes.login;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0F17),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(28),
                border: Border.all(color: const Color(0xFF293244)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x556C5CE7),
                    blurRadius: 30,
                    spreadRadius: 2,
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Image.asset(
                'assets/branding/n5_crown_emblem.png',
                fit: BoxFit.cover,
                semanticLabel: 'N5 Game crown emblem',
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'N5 GAME',
              style: TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.w800,
                letterSpacing: 2.2,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'PLAY • WIN • ENJOY',
              style: TextStyle(
                color: Color(0xFFA8B0C0),
                fontSize: 11,
                letterSpacing: 2,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 42),
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2.2,
                valueColor: AlwaysStoppedAnimation(Color(0xFF8B7CFF)),
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'Loading...',
              style: TextStyle(
                color: Color(0xFF6F7889),
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
