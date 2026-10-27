import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:n5_game/core/config/app_routes.dart';
import 'package:n5_game/core/routing/app_router.dart';
import 'package:n5_game/main.dart';

void main() {
  testWidgets('Record N5 Navigation Flow Demonstration Video', (tester) async {
    final framesDir = Directory('build/video_frames');
    if (framesDir.existsSync()) {
      framesDir.deleteSync(recursive: true);
    }
    framesDir.createSync(recursive: true);

    // Set mobile device viewport (Pixel / Galaxy aspect ratio)
    tester.view.physicalSize = const ui.Size(412 * 2.0, 915 * 2.0);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(tester.view.resetPhysicalSize);

    final globalKey = GlobalKey();
    int frameIndex = 1;

    // Helper to capture a frame
    Future<void> capture(int count) async {
      await tester.runAsync(() async {
        final boundary = globalKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
        if (boundary == null) return;
        final image = await boundary.toImage(pixelRatio: 1.0);
        final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
        if (byteData == null) return;
        final bytes = byteData.buffer.asUint8List();

        for (int i = 0; i < count; i++) {
          final filename = 'build/video_frames/frame_${frameIndex.toString().padLeft(4, '0')}.png';
          File(filename).writeAsBytesSync(bytes);
          frameIndex++;
        }
      });
    }

    // Build App
    await tester.pumpWidget(
      RepaintBoundary(
        key: globalKey,
        child: const N5GameApp(),
      ),
    );
    await tester.pumpAndSettle();

    // STEP 1: App Launch & Login Screen
    appRouter.go(AppRoutes.login);
    await tester.pumpAndSettle();
    await capture(25); // ~1.5s on Login screen

    // STEP 2: Navigate to N5 Lobby (Home)
    appRouter.go(AppRoutes.home);
    await tester.pumpAndSettle();
    await capture(30); // ~2s on Lobby

    // STEP 3: Enter Slots Category
    final slotsFinder = find.text('Slots');
    expect(slotsFinder, findsOneWidget);
    await tester.tap(slotsFinder);
    await tester.pumpAndSettle();
    await capture(25); // ~1.5s on Slots category list

    // STEP 4: Enter Game Screen (Slots Game 1)
    final gameTile = find.text('Slots Game 1').first;
    await tester.tap(gameTile);
    await tester.pumpAndSettle();
    await capture(30); // ~2s inside Game screen

    // STEP 5: In-App Back Button Demonstration
    // User taps in-app Back button (AppBar leading)
    final backBtn = find.byTooltip('Back');
    expect(backBtn, findsOneWidget);
    await tester.tap(backBtn);
    await tester.pumpAndSettle();

    // Must be returned to N5 Lobby!
    expect(find.text('N5 GAME'), findsOneWidget);
    await capture(30); // ~2s showing successful return to Lobby

    // STEP 6: Enter another game to demonstrate Android System Back
    await tester.tap(find.text('Crash'));
    await tester.pumpAndSettle();
    await capture(20);

    await tester.tap(find.text('Crash Game 1').first);
    await tester.pumpAndSettle();
    await capture(30); // ~2s inside Crash game

    // STEP 7: Android System Back Event (Hardware key / Gesture)
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    // Must be returned to N5 Lobby!
    expect(find.text('N5 GAME'), findsOneWidget);
    await capture(30); // ~2s showing successful return to Lobby via Android Back

    // STEP 8: Submenu Navigation Demonstration
    // Navigate to Profile
    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();
    await capture(25); // Profile screen

    // Open Settings submenu
    final settingsBtn = find.byIcon(Icons.settings_outlined);
    await tester.tap(settingsBtn);
    await tester.pumpAndSettle();
    await capture(25); // Settings screen

    // Press Back from Settings submenu -> Returns to Profile
    await tester.tap(find.byTooltip('Back'));
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.settings_outlined), findsOneWidget);
    await capture(20); // Back in Profile

    // Press Back from Profile -> Returns to Lobby
    await tester.tap(find.byTooltip('Back'));
    await tester.pumpAndSettle();
    expect(find.text('N5 GAME'), findsOneWidget);
    await capture(25); // Back in Lobby

    // STEP 9: Exit Prevention Protection ("Press back again to exit")
    await tester.binding.handlePopRoute();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('Press back again to exit'), findsOneWidget);
    await capture(35); // Show floating SnackBar toast

    // Clean up timer
    await tester.pump(const Duration(seconds: 3));
  });
}

