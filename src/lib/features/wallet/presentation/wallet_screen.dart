import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import '../data/account_statement_api.dart';
import '../data/wallet_api.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  final _client = PlayerApiClient(PlayerApiClientConfig.fromEnvironment());
  late Future<_WalletData> _future = _load();

  Future<_WalletData> _load() async {
    final balance = await WalletApi(_client).balance();
    final now = DateTime.now();
    AccountStatementResponse? statement;
    try {
      statement = await AccountStatementApi(_client).fetch(from: now.subtract(const Duration(days: 30)), to: now);
    } catch (_) {
      // Recent activity is optional; the balance is what matters.
    }
    return _WalletData(balance, statement);
  }

  Future<void> _refresh() async {
    final next = _load();
    setState(() => _future = next);
    await next;
  }

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
        ),
        body: FutureBuilder<_WalletData>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('Wallet could not be loaded.', style: TextStyle(color: Colors.white)),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _refresh, child: const Text('Retry')),
                    ],
                  ),
                ),
              );
            }
            final data = snap.data!;
            final w = data.balance;
            final activity = <Widget>[
              for (final d in data.statement?.deposits.take(3) ?? const <AccountStatementDeposit>[])
                _transaction('Deposit', '+ Rs ${formatMinor(d.amountMinor)}', '${d.method} • ${d.status}', Icons.arrow_downward, true),
              for (final x in data.statement?.withdrawals.take(3) ?? const <AccountStatementWithdrawal>[])
                _transaction('Withdrawal', '- Rs ${formatMinor(x.amountMinor)}', '${x.method} • ${x.status}', Icons.arrow_upward, false),
            ];

            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _balanceCard(w),
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
                  _breakdownTile('Bonus / Promotional', 'Rs ${formatMinor(w.bonusMinor)}', Icons.card_giftcard),
                  _breakdownTile('Pending / Locked', 'Rs ${formatMinor(w.lockedMinor)}', Icons.lock_outline),
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
                  if (activity.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 16),
                      child: Text('No transactions in the last 30 days.', style: TextStyle(color: Color(0xFFA8B0C0))),
                    )
                  else
                    ...activity,
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _balanceCard(WalletBalance w) {
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
                child: Text(
                  w.currency,
                  style: const TextStyle(color: Color(0xFFF5C542), fontSize: 11, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Rs ${formatMinor(w.availableMinor)}',
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
        // Refresh on return so a new deposit or withdrawal shows up.
        onPressed: () => context.push(title == 'Deposit' ? AppRoutes.deposit : AppRoutes.withdrawal).then((_) {
          if (mounted) _refresh();
        }),
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

class _WalletData {
  final WalletBalance balance;
  final AccountStatementResponse? statement;
  const _WalletData(this.balance, this.statement);
}
