import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import '../data/agent_api.dart';

class AgentDashboardScreen extends StatefulWidget {
  const AgentDashboardScreen({super.key});

  @override
  State<AgentDashboardScreen> createState() => _AgentDashboardScreenState();
}

class _AgentDashboardScreenState extends State<AgentDashboardScreen> {
  final _api = AgentApi(PlayerApiClient(PlayerApiClientConfig.fromEnvironment()));
  late Future<Map<String, dynamic>> _future = _load();
  bool _applying = false;

  Future<Map<String, dynamic>> _load() async {
    final body = await _api.get();
    return Map<String, dynamic>.from(body['data'] as Map);
  }

  Future<void> _apply() async {
    setState(() => _applying = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await _api.apply();
      messenger.showSnackBar(const SnackBar(content: Text('Application sent. Our team will review it.')));
      setState(() => _future = _load());
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('Could not send the application. Try again.')));
    } finally {
      if (mounted) setState(() => _applying = false);
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'not_applied':
        return 'Not an agent yet';
      case 'pending':
        return 'Application under review';
      case 'approved':
      case 'active':
        return 'Active agent';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.profile,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.profile),
          title: const Text('Agent Dashboard'),
        ),
        body: FutureBuilder<Map<String, dynamic>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return Center(
                child: TextButton(
                  onPressed: () => setState(() => _future = _load()),
                  child: const Text('Could not load agent data. Retry'),
                ),
              );
            }
            final d = snap.data!;
            final status = (d['status'] ?? 'not_applied') as String;
            final commission = Map<String, dynamic>.from((d['commission'] as Map?) ?? const {});
            String c(String k) => '${commission[k] ?? 0}';

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Agent Status', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 6),
                        Text(_statusLabel(status)),
                        if (status == 'not_applied') ...[
                          const SizedBox(height: 14),
                          const Text(
                            'Agents earn commission on players they bring in. Apply and our team will review your account.',
                            style: TextStyle(color: Colors.grey),
                          ),
                          const SizedBox(height: 12),
                          ElevatedButton(
                            onPressed: _applying ? null : _apply,
                            child: Text(_applying ? 'Sending...' : 'Apply to Become an Agent'),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(child: _stat('Referred players', '${d['directUsers'] ?? 0}')),
                    const SizedBox(width: 10),
                    Expanded(child: _stat('Qualified', '${d['qualifiedUsers'] ?? 0}')),
                  ],
                ),
                const SizedBox(height: 14),
                const Text('Commissions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                const Text('Number of commission entries by status', style: TextStyle(color: Colors.grey, fontSize: 12)),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _stat('Pending', c('pending'))),
                    const SizedBox(width: 10),
                    Expanded(child: _stat('Approved', c('approved'))),
                    const SizedBox(width: 10),
                    Expanded(child: _stat('Paid', c('paid'))),
                  ],
                ),
                const SizedBox(height: 14),
                ListTile(
                  leading: const Icon(Icons.share_outlined),
                  title: const Text('Your referral code'),
                  subtitle: const Text('Share it to bring in players'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push(AppRoutes.referral),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _stat(String title, String value) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 10),
        child: Column(
          children: [
            Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(title, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
