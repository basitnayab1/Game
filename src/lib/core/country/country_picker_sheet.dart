import 'package:flutter/material.dart';
import 'country_config.dart';
import '../localization/localization_service.dart';

void showCountryPickerSheet(BuildContext context, {ValueChanged<CountryConfig>? onSelected}) {
  showModalBottomSheet(
    context: context,
    backgroundColor: const Color(0xFF131926),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Select Your Country / Region',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Payment methods, currency and dialing code will adapt automatically.',
                style: TextStyle(color: Color(0xFFA8B0C0), fontSize: 13),
              ),
              const SizedBox(height: 16),
              ...CountryConfig.allCountries.map((country) {
                final isSelected = country.id == CountryService.active.id;
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? const Color(0xFF1F293D) : const Color(0xFF171E2C),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isSelected ? const Color(0xFFF5C542) : const Color(0xFF293244),
                      width: isSelected ? 1.5 : 1,
                    ),
                  ),
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                    leading: Text(
                      country.flag,
                      style: const TextStyle(fontSize: 28),
                    ),
                    title: Text(
                      country.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                    subtitle: Text(
                      '${country.dialCode} • ${country.currencyCode} (${country.currencySymbol}) • Local & Crypto',
                      style: const TextStyle(color: Color(0xFFA8B0C0), fontSize: 12),
                    ),
                    trailing: isSelected
                        ? const Icon(Icons.check_circle_rounded, color: Color(0xFFF5C542), size: 22)
                        : const Icon(Icons.chevron_right_rounded, color: Colors.white30, size: 20),
                    onTap: () {
                      CountryService.setCountry(country);
                      LocalizationService.setLanguageForCountry(country.id);
                      onSelected?.call(country);
                      Navigator.pop(ctx);
                    },
                  ),
                );
              }),
            ],
          ),
        ),
      );
    },
  );
}

class CountrySelectorCard extends StatelessWidget {
  final CountryConfig country;
  final VoidCallback onTap;

  const CountrySelectorCard({
    super.key,
    required this.country,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF131926),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFF293244)),
        ),
        child: Row(
          children: [
            Text(country.flag, style: const TextStyle(fontSize: 24)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Country / Region',
                    style: TextStyle(color: Color(0xFFA8B0C0), fontSize: 11),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${country.name} (${country.currencyCode})',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF1F293D),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    country.dialCode,
                    style: const TextStyle(color: Color(0xFFF5C542), fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                  const SizedBox(width: 4),
                  const Icon(Icons.expand_more_rounded, color: Colors.white70, size: 16),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

