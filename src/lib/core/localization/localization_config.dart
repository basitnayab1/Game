class LocalizationConfig {
  static const supportedLanguageCodes = <String>['en', 'tr', 'hi', 'ur', 'ar', 'bn'];
  static const rtlLanguageCodes = <String>['ur', 'ar'];

  static bool isRtl(String code) => rtlLanguageCodes.contains(code.toLowerCase());
}
