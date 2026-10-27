import 'package:flutter/material.dart';
import '../../../core/country/country_config.dart';
import '../../../core/localization/localization_service.dart';

class BalanceCard extends StatelessWidget {
  final String balance;
  final VoidCallback onDeposit;
  final VoidCallback onWithdraw;

  const BalanceCard({
    super.key,
    required this.balance,
    required this.onDeposit,
    required this.onWithdraw,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF242C3B), Color(0xFF171E2B)],
        ),
        border: Border.all(color: const Color(0xFF293244)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.tr('available_balance', defaultText: 'Available Balance'),
            style: const TextStyle(color: Color(0xFFA8B0C0), fontSize: 13),
          ),
          const SizedBox(height: 6),
          ValueListenableBuilder<CountryConfig>(
            valueListenable: CountryService.countryNotifier,
            builder: (context, country, _) => Text(
              '${country.currencyCode} ${country.currencySymbol} $balance',
              style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
              child: ElevatedButton(
                onPressed: onDeposit,
                child: Text(context.tr('deposit', defaultText: 'Deposit')),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton(
                onPressed: onWithdraw,
                child: Text(context.tr('withdraw', defaultText: 'Withdraw')),
              ),
            ),
          ]),
        ],
      ),
    );
  }
}
