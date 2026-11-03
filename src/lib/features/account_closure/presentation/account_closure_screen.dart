import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';

class AccountClosureScreen extends StatefulWidget {
  const AccountClosureScreen({super.key});

  @override
  State<AccountClosureScreen> createState() => _AccountClosureScreenState();
}

class _AccountClosureScreenState extends State<AccountClosureScreen> {
  final _client = PlayerApiClient(PlayerApiClientConfig.fromEnvironment());
  bool _confirmed = false;
  bool _busy = false;
  bool _loading = true;

  /// The server's closure request status, or null when none is open.
  String? _status;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await _client.get('/account-closure');
      final data = (r.data as Map)['data'];
      final status = data is Map ? data['status'] as String? : null;
      _status = status == 'CANCELLED' ? null : status;
    } catch (_) {
      _status = null;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String get _statusText {
    switch (_status) {
      case null:
        return 'No closure request';
      case 'CLOSED':
        return 'Account closed';
      default:
        return 'Closure requested — our team will review it';
    }
  }

  Future<void> _call(String path, String success) async {
    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await _client.post(path, data: const {});
      messenger.showSnackBar(SnackBar(content: Text(success)));
      await _load();
    } on DioException catch (e) {
      final body = e.response?.data;
      final error = body is Map ? body['error'] : null;
      final code = error is Map ? error['code'] : null;
      messenger.showSnackBar(SnackBar(
        content: Text(code == 'PENDING_OBLIGATIONS'
            ? 'Finish pending transactions and support cases before closing your account.'
            : 'Request failed. Try again.'),
      ));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _requestClosure() {
    if (!_confirmed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please confirm the closure request.')),
      );
      return;
    }
    _call('/account-closure', 'Closure request sent.');
  }

  @override
  Widget build(BuildContext context) {
    final closed = _status == 'CLOSED';
    final requested = _status != null && !closed;

    return N5BackScope(
      fallbackRoute: AppRoutes.profile,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.profile),
          title: const Text('Account Closure'),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary.withOpacity(.10),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Row(
                      children: [
                        Icon(closed ? Icons.check_circle_outline : Icons.lock_outline, size: 34),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Account Closure', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 4),
                              Text(_statusText),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text('Before closing your account', style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  _item(
                    Icons.account_balance_wallet_outlined,
                    'Pending balance and transactions',
                    'Pending deposits or withdrawals must finish before the account can be closed.',
                  ),
                  _item(
                    Icons.support_agent,
                    'Open support cases',
                    'Open support cases must be resolved first.',
                  ),
                  _item(
                    Icons.description_outlined,
                    'Required records',
                    'Some records are kept for legal, security and financial reasons after closure.',
                  ),
                  const SizedBox(height: 18),
                  if (requested)
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: _busy ? null : () => _call('/account-closure/cancel', 'Closure request cancelled.'),
                        child: const Text('Cancel Closure Request'),
                      ),
                    )
                  else if (!closed) ...[
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _confirmed,
                      onChanged: (v) => setState(() => _confirmed = v ?? false),
                      title: const Text('I want to request closure of my N5 Game account.'),
                      controlAffinity: ListTileControlAffinity.leading,
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _busy ? null : _requestClosure,
                        child: const Text('Request Account Closure'),
                      ),
                    ),
                  ],
                ],
              ),
      ),
    );
  }

  Widget _item(IconData icon, String title, String subtitle) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: Icon(icon),
        title: Text(title),
        subtitle: Text(subtitle),
      ),
    );
  }
}
