
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';

class ReferralScreen extends StatelessWidget {
  const ReferralScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.home,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.home),
          title: const Text('Referral'),
        ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _summaryCard(),
          const SizedBox(height: 16),
          _codeCard(context),
          const SizedBox(height: 16),
          const Text('Referral Overview',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          Row(
            children: const [
              Expanded(child: _StatCard(title: 'Total', value: '0')),
              SizedBox(width: 10),
              Expanded(child: _StatCard(title: 'Pending', value: '0')),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: const [
              Expanded(child: _StatCard(title: 'Qualified', value: '0')),
              SizedBox(width: 10),
              Expanded(child: _StatCard(title: 'Rewarded', value: '0')),
            ],
          ),
          const SizedBox(height: 20),
          ListTile(
            leading: const Icon(Icons.history),
            title: const Text('Referral History'),
            subtitle: const Text('View referral status and rewards'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push(AppRoutes.referralHistory),
          ),
          const SizedBox(height: 8),
          const Text(
            'Referral rewards are subject to eligibility, anti-fraud checks, '
            'applicable rules, and Admin configuration.',
            style: TextStyle(color: Colors.grey, fontSize: 12),
          ),
        ],
      ),
    ));
  }

  Widget _summaryCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            Text('Referral Rewards',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            SizedBox(height: 8),
            Text('Invite eligible users and track your referral progress.'),
          ],
        ),
      ),
    );
  }

  Widget _codeCard(BuildContext context) {
    const code = 'Your code';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          children: [
            const Text('Your Referral Code',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            Text(code,
                style: const TextStyle(
                    fontSize: 28, fontWeight: FontWeight.w800)),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      // Production: copy code using clipboard package.
                    },
                    icon: const Icon(Icons.copy),
                    label: const Text('Copy'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {
                      // Production: native share sheet.
                    },
                    icon: const Icon(Icons.share),
                    label: const Text('Share'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => showDialog(
                context: context,
                builder: (_) => AlertDialog(
                  title: const Text('Referral QR'),
                  content: SizedBox(
                    height: 180,
                    child: Center(
                      child: Container(
                        width: 150,
                        height: 150,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.grey),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text('QR\nYour code',
                            textAlign: TextAlign.center),
                      ),
                    ),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Close'),
                    ),
                  ],
                ),
              ),
              icon: const Icon(Icons.qr_code_2),
              label: const Text('Show QR'),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;

  const _StatCard({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
        child: Column(
          children: [
            Text(value,
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(title, style: const TextStyle(color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}

class ReferralHistoryScreen extends StatelessWidget {
  const ReferralHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const items = <Map<String, String>>[];

    return N5BackScope(
      fallbackRoute: AppRoutes.referral,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.referral),
          title: const Text('Referral History'),
        ),
        body: items.isEmpty
            ? const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'No referrals yet.\nYour referral activity will appear here.',
                    textAlign: TextAlign.center,
                  ),
                ),
              )
            : ListView.builder(
                itemCount: items.length,
                itemBuilder: (_, index) {
                  final item = items[index];
                  return ListTile(
                    title: Text(item['id'] ?? ''),
                    subtitle: Text(item['date'] ?? ''),
                    trailing: Text(item['status'] ?? ''),
                  );
                },
              ),
      ),
    );
  }
}
