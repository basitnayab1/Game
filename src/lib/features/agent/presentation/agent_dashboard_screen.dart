
import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';

class AgentDashboardScreen extends StatelessWidget {
  const AgentDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.profile,
      child: DefaultTabController(
        length: 5,
        child: Scaffold(
          appBar: AppBar(
            leading: const N5BackButton(fallbackRoute: AppRoutes.profile),
            title: const Text('Agent Dashboard'),
            bottom: const TabBar(
              isScrollable: true,
              tabs: [
                Tab(text: 'Home'),
                Tab(text: 'Promotion Sharing'),
                Tab(text: 'My Data'),
                Tab(text: 'Commission'),
                Tab(text: 'Subordinates'),
              ],
            ),
          ),
          body: const TabBarView(
            children: [
              _AgentHome(),
              _PromotionSharing(),
              _MyData(),
              _Commission(),
              _Subordinates(),
            ],
          ),
        ),
      ),
    );
  }
}

class _AgentHome extends StatelessWidget {
  const _AgentHome();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text('Agent Status',
                    style:
                        TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                SizedBox(height: 8),
                Text('Not Applied'),
                SizedBox(height: 14),
                Text(
                  'Agent access requires backend verification and approval.',
                  style: TextStyle(color: Colors.grey),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        _Metric(title: 'Direct Referrals', value: '0'),
        _Metric(title: 'Network', value: '0'),
        _Metric(title: 'Performance', value: '0'),
        _Metric(title: 'Commission', value: '0.00'),
      ],
    );
  }
}

class _PromotionSharing extends StatelessWidget {
  const _PromotionSharing();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Promotion Sharing',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const Icon(Icons.link),
            title: const Text('Agent Referral Link'),
            subtitle: const Text('Backend-generated link'),
            trailing: IconButton(
              icon: const Icon(Icons.share),
              onPressed: () {
                // Production: use native share sheet.
              },
            ),
          ),
        ),
        Card(
          child: ListTile(
            leading: const Icon(Icons.qr_code_2),
            title: const Text('Agent QR'),
            subtitle: const Text('Backend-generated QR'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {},
          ),
        ),
      ],
    );
  }
}

class _MyData extends StatelessWidget {
  const _MyData();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        _Metric(title: 'Agent ID', value: '—'),
        _Metric(title: 'Status', value: 'Not Applied'),
        _Metric(title: 'Direct Users', value: '0'),
        _Metric(title: 'Network Users', value: '0'),
        _Metric(title: 'Qualified Users', value: '0'),
      ],
    );
  }
}

class _Commission extends StatelessWidget {
  const _Commission();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        Card(
          child: Padding(
            padding: EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Commission',
                    style:
                        TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                SizedBox(height: 8),
                Text('Current Commission: 0.00'),
                SizedBox(height: 6),
                Text('Pending: 0.00'),
                SizedBox(height: 6),
                Text('Paid: 0.00'),
              ],
            ),
          ),
        ),
        SizedBox(height: 12),
        Text(
          'Commission rules, rates, qualification and settlement status '
          'must come from the backend/Admin configuration.',
          style: TextStyle(color: Colors.grey, fontSize: 12),
        ),
      ],
    );
  }
}

class _Subordinates extends StatelessWidget {
  const _Subordinates();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'No subordinate accounts yet.',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  final String title;
  final String value;

  const _Metric({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(title),
        trailing: Text(
          value,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}
