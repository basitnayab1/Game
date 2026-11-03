import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:n5_game/core/config/app_routes.dart';
import 'package:n5_game/core/localization/localization_service.dart';
import 'package:n5_game/core/routing/app_router.dart';
import 'package:n5_game/main.dart';

/// The login and signup forms must build without errors in every language;
/// a build error shows up as an empty grey box in release builds.
void main() {
  test('starts in English, ignoring a language older builds picked from the country', () async {
    SharedPreferences.setMockInitialValues({'n5_selected_language': 'ur'});
    await LocalizationService.init();
    expect(LocalizationService.activeLanguage.code, 'en');
  });

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
  });

  for (final lang in ['en', 'ur']) {
    for (final route in [AppRoutes.login, AppRoutes.register]) {
      testWidgets('$route renders its form in $lang', (tester) async {
        await tester.binding.setSurfaceSize(const Size(412, 915));
        await LocalizationService.setLanguage(lang);
        await tester.pumpWidget(const N5GameApp());
        await tester.pump(const Duration(seconds: 5));

        appRouter.go(route);
        await tester.pump(const Duration(seconds: 1));
        await tester.pump(const Duration(seconds: 1));

        expect(tester.takeException(), isNull);
        expect(find.byType(TextField), findsWidgets);
      });
    }
  }
}
