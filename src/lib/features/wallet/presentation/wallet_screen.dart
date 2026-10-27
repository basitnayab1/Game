import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/country/country_config.dart';
import '../../../core/country/country_picker_sheet.dart';
import '../../../core/navigation/n5_navigation.dart';

class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.home,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          backgroundColor: const Color(0xFF131926),
          leading: const N5BackButton(fallbackRoute: AppRoutes.home),
          title: const Text('Wallet', style: TextStyle(fontWeight: FontWeight.w700)),
          actions: [
            IconButton(
              icon: const Icon(Icons.language_rounded, color: Color(0xFFF5C542)),
              tooltip: 'Change Country',
              onPressed: () => showCountryPickerSheet(context),
            ),
          ],
        ),
        body: ValueListenableBuilder<CountryConfig>(
          valueListenable: CountryService.countryNotifier,
          builder: (context, country, _) {
            final symbol = country.currencySymbol;
            final isUsd = country.id == 'US';
            final balNum = isUsd ? '250.00' : '25,000';
            final bonusNum = isUsd ? '25.00' : '2,500';

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _balanceCard(country, balNum),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(child: _actionButton(context, 'Deposit', Icons.add_circle_outline, true)),
                    const SizedBox(width: 12),
                    Expanded(child: _actionButton(context, 'Withdraw', Icons.account_balance_wallet_outlined, false)),
                  ],
                ),
                const SizedBox(height: 22),
                const Text(
                  'Balance Breakdown',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 10),
                _breakdownTile('Bonus / Promotional', '$symbol $bonusNum', Icons.card_giftcard),
                _breakdownTile('Pending / Locked', '$symbol 0', Icons.lock_outline),
                const SizedBox(height: 22),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Recent Activity',
                      style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                    ),
                    TextButton(
                      onPressed: () => context.push(AppRoutes.statement),
                      child: const Text('View Statement'),
                    ),
                  ],
                ),
                _transaction('Deposit', '+ $symbol ${isUsd ? '100.00' : '5,000'}', 'Confirmed', Icons.arrow_downward, true),
                _transaction('Withdrawal', '- $symbol ${isUsd ? '50.00' : '2,000'}', 'Completed', Icons.arrow_upward, false),
                _transaction('Bonus', '+ $symbol ${isUsd ? '10.00' : '500'}', 'Confirmed', Icons.card_giftcard, true),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _balanceCard(CountryConfig country, String balance) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1D2635), Color(0xFF171E2B)],
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF293244)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Available Balance', style: TextStyle(color: Color(0xFFA8B0C0), fontSize: 13)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF162030),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF2A364F)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(country.flag, style: const TextStyle(fontSize: 14)),
                    const SizedBox(width: 4),
                    Text(
                      country.currencyCode,
                      style: const TextStyle(color: Color(0xFFF5C542), fontSize: 11, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${country.currencySymbol} $balance',
            style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }

  Widget _actionButton(BuildContext context, String title, IconData icon, bool isPrimary) {
    return SizedBox(
      height: 48,
      child: ElevatedButton.icon(
        style: ElevatedButton.styleFrom(
          backgroundColor: isPrimary ? const Color(0xFFF5C542) : const Color(0xFF1E2838),
          foregroundColor: isPrimary ? const Color(0xFF0F172A) : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        onPressed: () => context.push(title == 'Deposit' ? AppRoutes.deposit : AppRoutes.withdrawal),
        icon: Icon(icon, size: 20),
        label: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
      ),
    );
  }

  Widget _breakdownTile(String title, String value, IconData icon) {
    return Card(
      color: const Color(0xFF131926),
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFF242E40)),
      ),
      child: ListTile(
        leading: Icon(icon, color: const Color(0xFFF5C542)),
        title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 14)),
        trailing: Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
      ),
    );
  }

  Widget _transaction(
    String title,
    String amount,
    String status,
    IconData icon,
    bool positive,
  ) {
    return Card(
      color: const Color(0xFF131926),
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFF242E40)),
      ),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: positive ? const Color(0xFF10B981).withOpacity(0.15) : const Color(0xFFEF4444).withOpacity(0.15),
          child: Icon(icon, size: 18, color: positive ? const Color(0xFF10B981) : const Color(0xFFEF4444)),
        ),
        title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
        subtitle: Text(status, style: const TextStyle(color: Color(0xFFA8B0C0), fontSize: 12)),
        trailing: Text(
          amount,
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 14,
            color: positive ? const Color(0xFF10B981) : const Color(0xFFEF4444),
          ),
        ),
      ),
    );
  }
}
