import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';

enum ClosureStatus {
  notRequested,
  pendingVerification,
  pendingObligations,
  processing,
  closed,
}

class AccountClosureScreen extends StatefulWidget {
  const AccountClosureScreen({super.key});

  @override
  State<AccountClosureScreen> createState() => _AccountClosureScreenState();
}

class _AccountClosureScreenState extends State<AccountClosureScreen> {
  ClosureStatus _status = ClosureStatus.notRequested;
  bool _confirmed = false;

  String get _statusText {
    switch (_status) {
      case ClosureStatus.notRequested:
        return 'No closure request';
      case ClosureStatus.pendingVerification:
        return 'Pending security verification';
      case ClosureStatus.pendingObligations:
        return 'Checking pending obligations';
      case ClosureStatus.processing:
        return 'Closure processing';
      case ClosureStatus.closed:
        return 'Account closed';
    }
  }

  void _requestClosure() {
    if (!_confirmed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please confirm the closure request.')),
      );
      return;
    }

    // Demo UI flow only. Production state must come from the backend.
    setState(() => _status = ClosureStatus.pendingVerification);
  }

  void _advanceDemo() {
    setState(() {
      switch (_status) {
        case ClosureStatus.pendingVerification:
          _status = ClosureStatus.pendingObligations;
          break;
        case ClosureStatus.pendingObligations:
          _status = ClosureStatus.processing;
          break;
        case ClosureStatus.processing:
          _status = ClosureStatus.closed;
          break;
        case ClosureStatus.notRequested:
        case ClosureStatus.closed:
          break;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final closed = _status == ClosureStatus.closed;

    return N5BackScope(
      fallbackRoute: AppRoutes.profile,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.profile),
          title: const Text('Account Closure'),
        ),
        body: ListView(
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
                Icon(
                  closed ? Icons.check_circle_outline : Icons.lock_outline,
                  size: 34,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Account Closure',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(_statusText),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Before closing your account',
            style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          _item(
            Icons.account_balance_wallet_outlined,
            'Pending balance and transactions',
            'Any unresolved financial activity may need to be reviewed before closure.',
          ),
          _item(
            Icons.support_agent,
            'Open support cases',
            'Open issues may remain under review until they are resolved or otherwise handled.',
          ),
          _item(
            Icons.verified_user_outlined,
            'Security verification',
            'A security check may be required before the closure request is accepted.',
          ),
          _item(
            Icons.description_outlined,
            'Required records',
            'Certain records may need to be retained for applicable legal, regulatory, security or financial obligations.',
          ),
          const SizedBox(height: 18),
          if (!closed) ...[
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _confirmed,
              onChanged: (v) => setState(() => _confirmed = v ?? false),
              title: const Text('I want to request closure of my N5 Game account.'),
              subtitle: const Text(
                'I understand that closure processing may require verification and review of pending obligations.',
              ),
              controlAffinity: ListTileControlAffinity.leading,
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _status == ClosureStatus.notRequested
                    ? _requestClosure
                    : null,
                child: const Text('Request Account Closure'),
              ),
            ),
            if (_status != ClosureStatus.notRequested) ...[
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: _advanceDemo,
                child: const Text('Continue Demo Status Flow'),
              ),
            ],
          ] else
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: Theme.of(context).dividerColor,
                ),
              ),
              child: const Text(
                'The account-closure request is recorded locally in this prototype. '
                'Production closure must be confirmed by the backend.',
                style: TextStyle(height: 1.5),
              ),
            ),
          const SizedBox(height: 20),
          Text(
            'Production note: account closure must be server-authoritative. '
            'The app must not delete or alter financial/KYC/audit records directly.',
            style: TextStyle(
              color: Theme.of(context).textTheme.bodySmall?.color,
              height: 1.45,
            ),
          ),
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
