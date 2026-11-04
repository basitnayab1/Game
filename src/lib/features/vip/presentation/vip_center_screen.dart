import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';

/// VIP level, progress to the next level, and the daily salary claim.
class VipCenterScreen extends StatefulWidget {
  const VipCenterScreen({super.key});
  @override
  State<VipCenterScreen> createState() => _VipCenterScreenState();
}

class _VipCenterScreenState extends State<VipCenterScreen> {
  final _client = PlayerApiClient(PlayerApiClientConfig.fromEnvironment());
  late Future<Map<String, dynamic>> _future = _load();
  bool _claiming = false;

  Future<Map<String, dynamic>> _load() async {
    final r = await _client.get('/vip/progress');
    return Map<String, dynamic>.from((r.data as Map)['data'] as Map);
  }

  String _rs(num minor) {
    final v = minor / 100;
    return 'Rs ${v.toStringAsFixed(v == v.truncateToDouble() ? 0 : 2)}';
  }

  Future<void> _claim() async {
    setState(() => _claiming = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final r = await _client.post('/vip/salary/claim', data: const {});
      final d = Map<String, dynamic>.from((r.data as Map)['data'] as Map);
      messenger.showSnackBar(SnackBar(content: Text('${_rs(d['amountMinor'] as num)} salary added to your wallet.')));
      setState(() => _future = _load());
    } on DioException catch (e) {
      final body = e.response?.data;
      final err = body is Map ? body['error'] : null;
      messenger.showSnackBar(SnackBar(content: Text(err is Map ? '${err['message'] ?? err['code']}' : 'Could not claim. Try again.')));
    } finally {
      if (mounted) setState(() => _claiming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.home,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.home),
          title: const Text('VIP Center'),
        ),
        body: FutureBuilder<Map<String, dynamic>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return Center(
                child: TextButton(onPressed: () => setState(() => _future = _load()), child: const Text('Could not load VIP. Retry')),
              );
            }
            final d = snap.data!;
            final next = d['next'] == null ? null : Map<String, dynamic>.from(d['next'] as Map);
            final salary = (d['dailySalaryMinor'] as num?) ?? 0;
            final claimed = d['salaryClaimedToday'] == true;

            return RefreshIndicator(
              onRefresh: () async => setState(() => _future = _load()),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            const Icon(Icons.workspace_premium_rounded, color: Color(0xFFF5C542), size: 36),
                            const SizedBox(width: 12),
                            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text('VIP ${d['level']}', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900)),
                              Text('${d['tier'] ?? ''}', style: const TextStyle(color: Colors.grey)),
                            ]),
                          ]),
                          const SizedBox(height: 16),
                          Text('Total deposits: ${_rs(d['depositedMinor'] as num)}'),
                          Text('Total betting: ${_rs(d['betMinor'] as num)}'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Daily Salary', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 6),
                          Text(salary > 0 ? '${_rs(salary)} every day at your level' : 'Reach a higher level to earn a daily salary.',
                              style: const TextStyle(color: Colors.grey)),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: salary > 0 && !claimed && !_claiming ? _claim : null,
                              child: Text(claimed ? 'Claimed today — come back tomorrow' : (_claiming ? 'Claiming...' : 'Claim ${_rs(salary)}')),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (next != null) _nextLevelCard(d, next) else const Card(
                    child: Padding(
                      padding: EdgeInsets.all(18),
                      child: Text('You are at the highest level available right now.'),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _nextLevelCard(Map<String, dynamic> d, Map<String, dynamic> next) {
    Widget bar(String label, num have, num need) {
      final p = need <= 0 ? 1.0 : (have / need).clamp(0.0, 1.0).toDouble();
      return Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('$label: ${_rs(have < need ? have : need)} / ${_rs(need)}'),
            const SizedBox(height: 6),
            LinearProgressIndicator(value: p, minHeight: 8, borderRadius: BorderRadius.circular(8)),
          ],
        ),
      );
    }

    final bonus = (next['levelBonusMinor'] as num?) ?? 0;
    final salary = (next['dailySalaryMinor'] as num?) ?? 0;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Next: VIP ${next['level']}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            if (bonus > 0 || salary > 0)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  [if (bonus > 0) '${_rs(bonus)} level bonus', if (salary > 0) '${_rs(salary)} daily salary'].join(' • '),
                  style: const TextStyle(color: Color(0xFFF5C542)),
                ),
              ),
            bar('Deposit', d['depositedMinor'] as num, next['depositRequiredMinor'] as num),
            bar('Betting', d['betMinor'] as num, next['bettingRequiredMinor'] as num),
          ],
        ),
      ),
    );
  }
}
