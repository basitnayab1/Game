import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/localization/localization_service.dart';
import '../../../core/navigation/n5_navigation.dart';

class LanguageScreen extends StatefulWidget {
  const LanguageScreen({super.key});

  @override
  State<LanguageScreen> createState() => _LanguageScreenState();
}

class _LanguageScreenState extends State<LanguageScreen> {
  String _search = '';

  List<AppLanguage> get _filtered {
    final q = _search.trim().toLowerCase();
    if (q.isEmpty) return LocalizationService.supportedLanguages;
    return LocalizationService.supportedLanguages.where((x) =>
      x.name.toLowerCase().contains(q) ||
      x.nativeName.toLowerCase().contains(q) ||
      x.code.toLowerCase().contains(q)
    ).toList();
  }

  Future<void> _selectLanguage(AppLanguage language) async {
    await LocalizationService.setLanguage(language.code);
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${language.flag} ${language.nativeName} (${language.name}) ${LocalizationService.tr('selected', defaultText: 'selected')}.',
        ),
        backgroundColor: const Color(0xFF10B981),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<AppLanguage>(
      valueListenable: LocalizationService.languageNotifier,
      builder: (context, activeLang, _) {
        return N5BackScope(
          fallbackRoute: AppRoutes.settings,
          child: Scaffold(
            backgroundColor: const Color(0xFF0B0F17),
            appBar: AppBar(
              backgroundColor: const Color(0xFF131926),
              leading: const N5BackButton(fallbackRoute: AppRoutes.settings),
              title: Text(
                context.tr('select_language', defaultText: 'Select Language'),
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            body: Column(
              children: [
                // Search Bar
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: TextField(
                    onChanged: (v) => setState(() => _search = v),
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF94A3B8)),
                      hintText: context.tr('search_language', defaultText: 'Search language'),
                      hintStyle: const TextStyle(color: Colors.white38),
                      filled: true,
                      fillColor: const Color(0xFF131926),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFF293244)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFF293244)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFFF5C542), width: 1.5),
                      ),
                    ),
                  ),
                ),

                // Language List
                Expanded(
                  child: _filtered.isEmpty
                      ? Center(
                          child: Text(
                            context.tr('no_languages_found', defaultText: 'No languages found.'),
                            style: const TextStyle(color: Color(0xFFA8B0C0)),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          itemCount: _filtered.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (context, i) {
                            final language = _filtered[i];
                            final isSelected = language.code == activeLang.code;

                            return Container(
                              decoration: BoxDecoration(
                                color: isSelected ? const Color(0xFF1D2638) : const Color(0xFF131926),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: isSelected ? const Color(0xFFF5C542) : const Color(0xFF242E42),
                                  width: isSelected ? 1.5 : 1,
                                ),
                              ),
                              child: ListTile(
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                                leading: Container(
                                  width: 44,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF1F293D),
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: isSelected ? const Color(0xFFF5C542) : const Color(0xFF334155),
                                    ),
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    language.flag,
                                    style: const TextStyle(fontSize: 22),
                                  ),
                                ),
                                title: Row(
                                  children: [
                                    Text(
                                      language.nativeName,
                                      style: TextStyle(
                                        color: isSelected ? const Color(0xFFF5C542) : Colors.white,
                                        fontWeight: FontWeight.w800,
                                        fontSize: 16,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      '(${language.name})',
                                      style: const TextStyle(
                                        color: Color(0xFFA8B0C0),
                                        fontSize: 13,
                                      ),
                                    ),
                                    if (language.isRtl) ...[
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF6366F1).withOpacity(0.2),
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(color: const Color(0xFF6366F1)),
                                        ),
                                        child: const Text(
                                          'RTL',
                                          style: TextStyle(
                                            color: Color(0xFF818CF8),
                                            fontSize: 9,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                                subtitle: Text(
                                  'ISO: ${language.code.toUpperCase()}',
                                  style: const TextStyle(color: Color(0xFF64748B), fontSize: 11),
                                ),
                                trailing: isSelected
                                    ? Container(
                                        padding: const EdgeInsets.all(4),
                                        decoration: const BoxDecoration(
                                          color: Color(0xFFF5C542),
                                          shape: BoxShape.circle,
                                        ),
                                        child: const Icon(
                                          Icons.check,
                                          size: 16,
                                          color: Color(0xFF0F172A),
                                        ),
                                      )
                                    : const Icon(
                                        Icons.chevron_right_rounded,
                                        color: Color(0xFF475569),
                                      ),
                                onTap: () => _selectLanguage(language),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Helper modal sheet for quick language selection anywhere in the app
void showLanguagePickerSheet(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    backgroundColor: const Color(0xFF131926),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) {
      return ValueListenableBuilder<AppLanguage>(
        valueListenable: LocalizationService.languageNotifier,
        builder: (context, activeLang, _) {
          return Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFF334155),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      context.tr('select_language', defaultText: 'Select Language'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Icon(Icons.language_rounded, color: Color(0xFFF5C542)),
                  ],
                ),
                const SizedBox(height: 16),
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: LocalizationService.supportedLanguages.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, idx) {
                      final lang = LocalizationService.supportedLanguages[idx];
                      final isSelected = lang.code == activeLang.code;

                      return InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () async {
                          await LocalizationService.setLanguage(lang.code);
                          if (ctx.mounted) Navigator.pop(ctx);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFF1E2838) : const Color(0xFF171E2B),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isSelected ? const Color(0xFFF5C542) : const Color(0xFF293244),
                            ),
                          ),
                          child: Row(
                            children: [
                              Text(lang.flag, style: const TextStyle(fontSize: 22)),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  '${lang.nativeName} (${lang.name})',
                                  style: TextStyle(
                                    color: isSelected ? const Color(0xFFF5C542) : Colors.white,
                                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                    fontSize: 14,
                                  ),
                                ),
                              ),
                              if (isSelected)
                                const Icon(Icons.check_circle_rounded, color: Color(0xFFF5C542), size: 20),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          );
        },
      );
    },
  );
}
