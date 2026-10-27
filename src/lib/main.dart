import 'package:flutter/material.dart';
import 'core/localization/localization_service.dart';
import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await LocalizationService.init();
  runApp(const N5GameApp());
}

class N5GameApp extends StatelessWidget {
  const N5GameApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<AppLanguage>(
      valueListenable: LocalizationService.languageNotifier,
      builder: (context, activeLang, _) {
        return MaterialApp.router(
          title: 'N5 Game',
          debugShowCheckedModeBanner: false,
          theme: N5Theme.dark(),
          locale: activeLang.locale,
          supportedLocales: LocalizationService.supportedLanguages.map((l) => l.locale).toList(),
          routerConfig: appRouter,
          builder: (context, child) {
            return Directionality(
              textDirection: activeLang.direction,
              child: child ?? const SizedBox.shrink(),
            );
          },
        );
      },
    );
  }
}
