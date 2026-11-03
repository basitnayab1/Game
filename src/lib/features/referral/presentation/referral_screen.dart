import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import '../data/referral_api.dart';

ReferralApi _api() => ReferralApi(PlayerApiClient(PlayerApiClientConfig.fromEnvironment()));

class ReferralScreen extends StatefulWidget {
  const ReferralScreen({super.key});

  @override
  State<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends State<ReferralScreen> {
  late Future<Map<String, dynamic>> _future = _load();

  Future<Map<String, dynamic>> _load() async {
    final body = await _api().get();
    return Map<String, dynamic>.from(body['data'] as Map);
  }

  String _inviteText(String code) =>
      'N5 Game khelo — Aviator, Slots aur roz ka free Lucky Wheel! '
      'App download karo: https://n5gamez.com — signup par mera referral code daalna: $code';

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.home,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.home),
          title: const Text('Referral'),
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
                  child: const Text('Could not load referral data. Retry'),
                ),
              );
            }
            final data = snap.data!;
            final code = (data['code'] ?? '') as String;
            final s = Map<String, dynamic>.from((data['summary'] as Map?) ?? const {});
            String n(String k) => '${(s[k] as num?)?.toInt() ?? 0}';

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _summaryCard(),
                const SizedBox(height: 16),
                _codeCard(context, code),
                const SizedBox(height: 16),
                const Text('Referral Overview', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _StatCard(title: 'Total', value: n('total'))),
                    const SizedBox(width: 10),
                    Expanded(child: _StatCard(title: 'Pending', value: n('pending'))),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _StatCard(title: 'Qualified', value: n('qualified'))),
                    const SizedBox(width: 10),
                    Expanded(child: _StatCard(title: 'Rewarded', value: n('rewarded'))),
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
                  'Friends enter your code when they sign up. Referral rewards are subject to '
                  'eligibility and anti-fraud checks.',
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _summaryCard() {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Referral Rewards', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            SizedBox(height: 8),
            Text('Invite friends and track your referral progress.'),
          ],
        ),
      ),
    );
  }

  Widget _codeCard(BuildContext context, String code) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          children: [
            const Text('Your Referral Code', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            SelectableText(code, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: code.isEmpty
                        ? null
                        : () async {
                            final messenger = ScaffoldMessenger.of(context);
                            await Clipboard.setData(ClipboardData(text: code));
                            messenger.showSnackBar(const SnackBar(content: Text('Referral code copied.')));
                          },
                    icon: const Icon(Icons.copy),
                    label: const Text('Copy'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: code.isEmpty
                        ? null
                        : () async {
                            final messenger = ScaffoldMessenger.of(context);
                            final text = _inviteText(code);
                            final uri = Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}');
                            if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
                              await Clipboard.setData(ClipboardData(text: text));
                              messenger.showSnackBar(const SnackBar(content: Text('Invite message copied.')));
                            }
                          },
                    icon: const Icon(Icons.share),
                    label: const Text('Share'),
                  ),
                ),
              ],
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
            Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
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
    return N5BackScope(
      fallbackRoute: AppRoutes.referral,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.referral),
          title: const Text('Referral History'),
        ),
        body: FutureBuilder<List<dynamic>>(
          future: _api().history(),
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            final items = snap.data ?? const [];
            if (items.isEmpty) {
              return const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'No referrals yet.\nFriends who sign up with your code will appear here.',
                    textAlign: TextAlign.center,
                  ),
                ),
              );
            }
            return ListView.builder(
              itemCount: items.length,
              itemBuilder: (_, index) {
                final item = Map<String, dynamic>.from(items[index] as Map);
                final date = '${item['createdAt'] ?? item['created_at'] ?? ''}';
                final reward = (item['rewardMinor'] ?? item['reward_minor']);
                return ListTile(
                  leading: const Icon(Icons.person_add_alt_1_outlined),
                  title: Text('Referral • ${date.length >= 10 ? date.substring(0, 10) : date}'),
                  subtitle: reward == null ? null : Text('Reward: Rs ${(num.parse('$reward') / 100).toStringAsFixed(2)}'),
                  trailing: Text('${item['status'] ?? ''}'),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
