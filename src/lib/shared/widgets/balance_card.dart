import 'package:flutter/material.dart';
import '../../../core/localization/localization_service.dart';

class BalanceCard extends StatelessWidget {
  final String balance;
  final VoidCallback onDeposit;
  final VoidCallback onWithdraw;

  /// The wallet's own currency, as reported by the server.
  final String currency;

  /// Amount held for withdrawals still being processed, if any.
  final String? pendingWithdrawal;

  const BalanceCard({
    super.key,
    required this.balance,
    this.currency = 'PKR',
    this.pendingWithdrawal,
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                context.tr('available_balance', defaultText: 'Available Balance'),
                style: const TextStyle(color: Color(0xFFA8B0C0), fontSize: 13),
              ),
              // The wallet's currency, shown with the balance it belongs to.
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E2838),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFF2E3E58)),
                ),
                child: Text(currency,
                    style: const TextStyle(color: Color(0xFFF5C542), fontSize: 11, fontWeight: FontWeight.w800)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${currency == 'PKR' ? 'Rs' : currency} $balance',
            style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800),
          ),
          if (pendingWithdrawal != null) ...[
            const SizedBox(height: 4),
            Text(
              'Pending withdrawal: ${currency == 'PKR' ? 'Rs' : currency} $pendingWithdrawal',
              style: const TextStyle(color: Color(0xFFF5C542), fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ],
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
