import 'package:flutter/material.dart';

class N5LocaleSupport {
  static const rtlLanguageCodes = {'ur', 'ar'};

  static bool isRtl(String languageCode) =>
      rtlLanguageCodes.contains(languageCode.toLowerCase());

  static TextDirection directionFor(String languageCode) =>
      isRtl(languageCode) ? TextDirection.rtl : TextDirection.ltr;

  static Locale localeFromCode(String code) => Locale(code);
}
