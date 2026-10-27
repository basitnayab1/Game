import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import '../data/vip_api.dart';

class VipCenterScreen extends StatefulWidget {
  const VipCenterScreen({super.key});
  @override State<VipCenterScreen> createState() => _VipCenterScreenState();
}

class _VipCenterScreenState extends State<VipCenterScreen> {
  late final VipApi _api;
  late Future<VipPayload> _future;

  @override
  void initState() {
    super.initState();
    _api = VipApi(PlayerApiClient(PlayerApiClientConfig.fromEnvironment()));
    _future = _api.get();
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
      body: FutureBuilder<VipPayload>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || snapshot.data == null) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Text('Unable to load VIP data'),
                  const SizedBox(height: 12),
                  ElevatedButton(onPressed: () => setState(() => _future = _api.get()), child: const Text('Retry')),
                ]),
              ),
            );
          }
          final payload = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _currentCard(context, payload.summary),
              const SizedBox(height: 22),
              const Text('VIP Levels', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              ...payload.levels.map((level) => Card(
                child: ListTile(
                  leading: CircleAvatar(child: Text('${level.level}')),
                  title: Text('${level.name} • ${level.tier}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(level.dailySalaryMinor == null ? 'Benefits configured' : 'Daily salary configured'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('${AppRoutes.vipDetail}?level=${level.level}'),
                ),
              )),
              const SizedBox(height: 12),
              const Text(
                'VIP progression, thresholds and reward values are server-controlled and configurable according to the final lawful/licensed operating model and responsible-use rules.',
                style: TextStyle(fontSize: 12, color: Color(0xFFA8B0C0)),
              ),
            ],
          );
        },
      ),
    ));
  }

  Widget _currentCard(BuildContext context, VipSummary summary) {
    final progress = summary.progress.clamp(0.0, 1.0).toDouble();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Current VIP', style: TextStyle(color: Color(0xFFA8B0C0))),
          const SizedBox(height: 6),
          Text('${summary.name} • ${summary.tier}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
          LinearProgressIndicator(value: progress),
          const SizedBox(height: 8),
          Text('${(progress * 100).round()}% progress'),
          if (summary.nextLevel != null) ...[
            const SizedBox(height: 8),
            Text('Next: VIP ${summary.nextLevel}'),
          ],
          const SizedBox(height: 14),
          OutlinedButton(
            onPressed: () => context.push('${AppRoutes.vipDetail}?level=${summary.level}'),
            child: const Text('View Current Benefits'),
          ),
        ]),
      ),
    );
  }
}
