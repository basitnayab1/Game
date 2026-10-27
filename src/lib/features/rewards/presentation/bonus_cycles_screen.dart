import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../data/rewards_api.dart';
import '../../../core/networking/player_api_client.dart';

class BonusCyclesScreen extends StatefulWidget {
  const BonusCyclesScreen({super.key});
  @override
  State<BonusCyclesScreen> createState() => _BonusCyclesScreenState();
}

class _BonusCyclesScreenState extends State<BonusCyclesScreen> {
  late final RewardsApi _api;
  late Future<List<RewardCycleItem>> _future;

  @override
  void initState() {
    super.initState();
    _api = RewardsApi(PlayerApiClient(PlayerApiClientConfig.fromEnvironment()));
    _future = _api.cycles();
  }

  Future<void> _open(RewardCycleItem item) async {
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('${item.cycleType} Reward'),
        content: const Text('Reward available. Press OPEN to reveal and claim it.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Close')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(dialogContext);
              try {
                await _api.openCycle(item.id);
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Reward claimed successfully.')));
                setState(() => _future = _api.cycles());
              } catch (error) {
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Unable to open reward: $error')));
              }
            },
            child: const Text('OPEN'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.promotions,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.promotions),
          title: const Text('Weekly & Monthly Bonus'),
        ),
      body: FutureBuilder<List<RewardCycleItem>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) {
            return Center(child: ElevatedButton(onPressed: () => setState(() => _future = _api.cycles()), child: const Text('Retry')));
          }
          final cycles = (snapshot.data ?? const <RewardCycleItem>[])
              .where((item) => item.cycleType.toLowerCase() != 'daily')
              .toList();
          if (cycles.isEmpty) return const Center(child: Text('No reward cycles available'));
          return ListView(
            padding: const EdgeInsets.all(16),
            children: cycles.map((item) => Card(
              margin: const EdgeInsets.only(bottom: 14),
              child: ListTile(
                title: Text('${item.cycleType} Bonus'),
                subtitle: Text(item.cycleKey),
                trailing: item.status == 'claimed'
                    ? const Text('Claimed')
                    : item.status == 'expired'
                        ? const Text('Expired')
                        : ElevatedButton(onPressed: () => _open(item), child: const Text('OPEN')),
              ),
            )).toList(),
          );
        },
      ),
    ));
  }
}
