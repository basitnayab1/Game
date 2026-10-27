import 'package:flutter/material.dart';
import 'app_colors.dart';
class N5Theme {
  static ThemeData dark() => ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: N5Colors.background,
    colorScheme: const ColorScheme.dark(primary: N5Colors.primary, secondary: N5Colors.secondary, surface: N5Colors.surface, error: N5Colors.error),
    appBarTheme: const AppBarTheme(backgroundColor: N5Colors.background, elevation: 0, centerTitle: false),
    cardTheme: const CardTheme(color: N5Colors.surface, elevation: 0),
    inputDecorationTheme: InputDecorationTheme(
      filled: true, fillColor: N5Colors.surface,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: N5Colors.border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: N5Colors.border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: N5Colors.primary, width: 1.4)),
    ),
    textTheme: const TextTheme(bodyMedium: TextStyle(color: N5Colors.text), bodySmall: TextStyle(color: N5Colors.secondaryText)),
  );
}
