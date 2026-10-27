import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'app_translations.dart';

class AppLanguage {
  final String code;
  final String name;
  final String nativeName;
  final String flag;
  final bool isRtl;

  const AppLanguage({
    required this.code,
    required this.name,
    required this.nativeName,
    required this.flag,
    this.isRtl = false,
  });

  Locale get locale => Locale(code);
  TextDirection get direction => isRtl ? TextDirection.rtl : TextDirection.ltr;
}

class LocalizationService {
  LocalizationService._();

  static const String _prefKey = 'n5_selected_language';

  static const List<AppLanguage> supportedLanguages = [
    AppLanguage(code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', isRtl: false),
    AppLanguage(code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰', isRtl: true),
    AppLanguage(code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', isRtl: false),
    AppLanguage(code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩', isRtl: false),
    AppLanguage(code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', isRtl: true),
    AppLanguage(code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', isRtl: false),
  ];

  static AppLanguage _activeLanguage = supportedLanguages[0]; // English default
  static final ValueNotifier<AppLanguage> languageNotifier = ValueNotifier<AppLanguage>(_activeLanguage);

  static AppLanguage get activeLanguage => _activeLanguage;
  static bool get isRtl => _activeLanguage.isRtl;
  static Locale get currentLocale => _activeLanguage.locale;
  static TextDirection get currentDirection => _activeLanguage.direction;

  /// Initialize stored language preference from disk
  static Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedCode = prefs.getString(_prefKey);
      if (savedCode != null && savedCode.isNotEmpty) {
        final match = supportedLanguages.firstWhere(
          (l) => l.code.toLowerCase() == savedCode.toLowerCase(),
          orElse: () => supportedLanguages[0],
        );
        _activeLanguage = match;
        languageNotifier.value = match;
      }
    } catch (_) {
      // Fallback to English
    }
  }

  /// Change active language and persist across restarts
  static Future<void> setLanguage(String code) async {
    final match = supportedLanguages.firstWhere(
      (l) => l.code.toLowerCase() == code.toLowerCase(),
      orElse: () => supportedLanguages[0],
    );

    _activeLanguage = match;
    languageNotifier.value = match;

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefKey, match.code);
    } catch (_) {}
  }

  /// Automatically select matching language for a given country code
  static Future<void> setLanguageForCountry(String countryCode) async {
    final code = countryCode.toUpperCase();
    if (code == 'PK') {
      await setLanguage('ur');
    } else if (code == 'IN') {
      await setLanguage('hi');
    } else if (code == 'BD') {
      await setLanguage('bn');
    } else if (code == 'TR') {
      await setLanguage('tr');
    } else if (code == 'AE' || code == 'SA') {
      await setLanguage('ar');
    } else {
      await setLanguage('en');
    }
  }

  /// Translate a given key to active language
  static String tr(String key, {String? defaultText, Map<String, String>? params}) {
    final currentDict = AppTranslations.translations[_activeLanguage.code];
    String result = currentDict?[key] ?? AppTranslations.translations['en']?[key] ?? defaultText ?? key;

    if (params != null && params.isNotEmpty) {
      params.forEach((paramKey, paramVal) {
        result = result.replaceAll('{$paramKey}', paramVal);
      });
    }

    return result;
  }
}

/// Convenience extensions for Flutter BuildContext and Strings
extension LocalizationExtension on BuildContext {
  String tr(String key, {String? defaultText, Map<String, String>? params}) =>
      LocalizationService.tr(key, defaultText: defaultText, params: params);

  AppLanguage get activeLanguage => LocalizationService.activeLanguage;
  bool get isRtl => LocalizationService.isRtl;
  TextDirection get textDirection => LocalizationService.currentDirection;
}

extension StringTranslationExtension on String {
  String tr({String? defaultText, Map<String, String>? params}) =>
      LocalizationService.tr(this, defaultText: defaultText, params: params);
}

