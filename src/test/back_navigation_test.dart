import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:n5_game/core/config/app_routes.dart';
import 'package:n5_game/core/routing/app_router.dart';
import 'package:n5_game/main.dart';

void main() {
  // The home screen reads the session token on start; tests have no platform keystore.
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  group('N5 App Back Navigation Test Suite', () {
    testWidgets('Game -> In-App Back Button -> Returns to Lobby', (tester) async {
      await tester.pumpWidget(const N5GameApp());
      await tester.pumpAndSettle();

      appRouter.go(AppRoutes.home);
      await tester.pumpAndSettle();
      expect(find.text('N5 GAME'), findsOneWidget);

      // Open a game directly
      appRouter.go('${AppRoutes.gameDetail}?game=Slots%20Game%201');
      await tester.pumpAndSettle();
      expect(find.text('Play'), findsOneWidget);

      // Tap in-app Back button
      final backButton = find.byTooltip('Back');
      expect(backButton, findsOneWidget);
      await tester.tap(backButton);
      await tester.pumpAndSettle();

      // Must be back in N5 Lobby
      expect(find.text('N5 GAME'), findsOneWidget);
    });

    testWidgets('Game -> Android System Back -> Returns to Lobby', (tester) async {
      await tester.pumpWidget(const N5GameApp());
      await tester.pumpAndSettle();

      appRouter.go(AppRoutes.home);
      await tester.pumpAndSettle();
      expect(find.text('N5 GAME'), findsOneWidget);

      // Enter Slots category, then a game inside it
      await tester.tap(find.text('Slots'));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(AppBar, 'Slots'), findsOneWidget);

      appRouter.push('${AppRoutes.gameDetail}?game=N5%20Slots');
      await tester.pumpAndSettle();
      expect(find.text('Play'), findsOneWidget);

      // Trigger Android system Back gesture/key
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();

      // Should return directly to N5 Lobby
      expect(find.text('N5 GAME'), findsOneWidget);
    });

    testWidgets('Submenu -> In-App Back -> Returns to previous screen / Lobby', (tester) async {
      await tester.pumpWidget(const N5GameApp());
      await tester.pumpAndSettle();

      appRouter.go(AppRoutes.home);
      await tester.pumpAndSettle();

      // Tap Profile tab
      await tester.tap(find.text('Profile'));
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.settings_outlined), findsOneWidget);

      // Tap Settings in Profile AppBar
      await tester.tap(find.byIcon(Icons.settings_outlined));
      await tester.pumpAndSettle();
      expect(find.text('Settings'), findsOneWidget);

      // Tap In-App Back from Settings
      final backButton = find.byTooltip('Back');
      expect(backButton, findsOneWidget);
      await tester.tap(backButton);
      await tester.pumpAndSettle();

      // Must return to Profile
      expect(find.byIcon(Icons.settings_outlined), findsOneWidget);

      // Tap In-App Back from Profile
      final profileBackButton = find.byTooltip('Back');
      expect(profileBackButton, findsOneWidget);
      await tester.tap(profileBackButton);
      await tester.pumpAndSettle();

      // Must return to Lobby
      expect(find.text('N5 GAME'), findsOneWidget);
    });

    testWidgets('Lobby -> Android System Back once shows exit confirmation SnackBar', (tester) async {
      await tester.pumpWidget(const N5GameApp());
      await tester.pumpAndSettle();

      appRouter.go(AppRoutes.home);
      await tester.pumpAndSettle();
      expect(find.text('N5 GAME'), findsOneWidget);

      // Single Android system back press on lobby
      await tester.binding.handlePopRoute();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      // Must show "Press back again to exit" toast/snack
      expect(find.text('Press back again to exit'), findsOneWidget);
      // App remains on Lobby, not terminated
      expect(find.text('N5 GAME'), findsOneWidget);

      // Settle timer
      await tester.pump(const Duration(seconds: 3));
    });
  });
}
