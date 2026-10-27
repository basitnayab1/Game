import 'package:flutter/material.dart';

import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import '../data/account_statement_api.dart';

class AccountStatementScreen extends StatefulWidget {
  const AccountStatementScreen({super.key});

  @override
  State<AccountStatementScreen> createState() => _AccountStatementScreenState();
}

class _AccountStatementScreenState extends State<AccountStatementScreen> {
  late DateTime fromDate;
  late DateTime toDate;
  late final AccountStatementApi _api;
  AccountStatementResponse? _statement;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final today = DateTime.now();
    toDate = DateTime(today.year, today.month, today.day);
    final priorMonth = DateTime(today.year, today.month - 2, 1);
    fromDate = priorMonth;
    _api = AccountStatementApi(PlayerApiClient(PlayerApiClientConfig.fromEnvironment()));
  }

  Future<void> _loadStatement() async {
    if (fromDate.isAfter(toDate)) {
      setState(() => _error = 'From date cannot be after To date.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final result = await _api.fetch(from: fromDate, to: toDate);
      if (!mounted) return;
      setState(() => _statement = result);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Unable to load statement. Please try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickDate(bool isFrom) async {
    final initial = isFrom ? fromDate : toDate;
    final picked = await showDatePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
      initialDate: initial,
    );
    if (picked == null) return;
    setState(() {
      if (isFrom) {
        fromDate = picked;
      } else {
        toDate = picked;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.wallet,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.wallet),
          title: const Text('Account Statement'),
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _dateRangeCard(),
            const SizedBox(height: 18),
            const Text('Activity Summary',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            if (_loading) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
            if (_error != null) _errorCard(),
            if (_statement != null) ...[
              _summaryGrid(),
              const SizedBox(height: 24),
              const Text('Deposit History', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              ..._statement!.deposits.map((d) => _deposit(d.date, _money(d.amountMinor), d.method, d.status)),
              const SizedBox(height: 22),
              const Text('Withdrawal History', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              ..._statement!.withdrawals.map((w) => _withdrawal(w.date, _money(w.amountMinor), _money(w.feeMinor), _money(w.netMinor), w.method, w.status)),
            ],
            const SizedBox(height: 24),
            const SizedBox(height: 20),
            const Text(
              'No round-by-round game history is shown here. “Total Play” is an activity summary supplied by the backend for the selected date range.',
              style: TextStyle(fontSize: 12, color: Color(0xFFA8B0C0)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dateRangeCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Statement Period',
                style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _dateButton('From', fromDate, true)),
                const SizedBox(width: 10),
                Expanded(child: _dateButton('To', toDate, false)),
              ],
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  if (fromDate.isAfter(toDate)) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('From date cannot be after To date.')),
                    );
                    return;
                  }
                  _loadStatement();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Loading statement...')),
                  );
                },
                icon: const Icon(Icons.refresh),
                label: const Text('Apply Date Range'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dateButton(String label, DateTime date, bool isFrom) {
    return OutlinedButton(
      onPressed: () => _pickDate(isFrom),
      child: Column(
        children: [
          Text(label, style: const TextStyle(fontSize: 11)),
          const SizedBox(height: 3),
          Text('${date.day.toString().padLeft(2, '0')}/'
              '${date.month.toString().padLeft(2, '0')}/${date.year}'),
        ],
      ),
    );
  }

  Widget _summaryGrid() {
    final s = _statement?.summary;
    if (s == null) return const SizedBox.shrink();
    final items = <MapEntry<String, String>>[
      MapEntry('Total Deposit', _money(s.totalDepositMinor)),
      MapEntry('Total Play', _money(s.totalPlayMinor)),
      MapEntry('Total Withdrawal', _money(s.totalWithdrawalMinor)),
      MapEntry('Withdrawal Fee', _money(s.totalWithdrawalFeeMinor)),
      MapEntry('Total Bonus Received', _money(s.totalBonusReceivedMinor)),
    ];
    return Column(
      children: items
          .map(
            (item) => Card(
              child: ListTile(
                title: Text(item.key),
                trailing: Text(
                  item.value,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ),
          )
          .toList(),
    );
  }

  String _money(int minor) => 'PKR ${(minor / 100).toStringAsFixed(2)}';

  Widget _errorCard() => Card(child: ListTile(leading: const Icon(Icons.error_outline), title: Text(_error!), trailing: TextButton(onPressed: _loadStatement, child: const Text('Retry'))));

  Widget _deposit(String date, String amount, String method, String status) {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.arrow_downward),
        title: Text(amount),
        subtitle: Text('$date • $method'),
        trailing: _status(status),
      ),
    );
  }

  Widget _withdrawal(
      String date, String amount, String fee, String net, String method, String status) {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.arrow_upward),
        title: Text(amount),
        subtitle: Text('$date • $method • Fee $fee • Net $net'),
        trailing: _status(status),
      ),
    );
  }

  Widget _status(String status) {
    return Text(status, style: const TextStyle(fontWeight: FontWeight.w700));
  }
}
