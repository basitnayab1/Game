import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import 'vip_models.dart';

class VipLevelDetailScreen extends StatelessWidget {
  final VipLevel level;

  const VipLevelDetailScreen({super.key, required this.level});

  @override
  Widget build(BuildContext context) {
    final next = level.number < vipLevels.length ? vipLevels[level.number] : null;

    return N5BackScope(
      fallbackRoute: AppRoutes.vip,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.vip),
          title: Text(level.name),
        ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 36,
                    child: Text('${level.number}',
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                  ),
                  const SizedBox(height: 12),
                  Text(level.tier,
                      style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 5),
                  Text(level.name),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          _section('Level Reward', [
            ListTile(
              leading: const Icon(Icons.card_giftcard),
              title: const Text('Reward'),
              trailing: Text(level.reward,
                  style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
          ]),
          _section('Benefits', level.benefits.map((b) => ListTile(
            leading: const Icon(Icons.check_circle_outline),
            title: Text(b),
          )).toList()),
          _section('Progress & Criteria', [
            const ListTile(
              title: Text('Progress'),
              subtitle: Text('Calculated by the backend using the configured VIP policy.'),
            ),
            const ListTile(
              title: Text('Eligibility'),
              subtitle: Text('Account status, verification, responsible-use controls and configured policy apply.'),
            ),
            if (next != null)
              ListTile(
                title: const Text('Next Level'),
                subtitle: Text('${next.name} • ${next.tier}'),
              ),
          ]),
          _section('Reward History', [
            const ListTile(
              leading: Icon(Icons.history),
              title: Text('View reward history'),
              subtitle: Text('Level-up and VIP rewards are recorded server-side.'),
            ),
          ]),
          const SizedBox(height: 10),
          const Text(
            'No client-side VIP level or reward can be edited. The server is authoritative.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Color(0xFFA8B0C0)),
          ),
        ],
      ),
    ));
  }

  Widget _section(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 18),
        Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        Card(child: Column(children: children)),
      ],
    );
  }
}
