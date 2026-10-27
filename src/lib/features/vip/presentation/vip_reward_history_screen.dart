import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';

class VipRewardHistoryScreen extends StatelessWidget {
  const VipRewardHistoryScreen({super.key});

  static const rewards = [
    ('VIP 3 • Bronze III', 'Configured reward', 'Claimed'),
    ('VIP 5 • Silver II', 'Configured reward', 'Claimed'),
    ('VIP 7 • Gold I', 'Configured reward', 'Available'),
  ];

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.vip,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.vip),
          title: const Text('VIP Reward History'),
        ),
        body: ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: rewards.length,
          itemBuilder: (_, index) {
            final item = rewards[index];
            return Card(
              child: ListTile(
                leading: const Icon(Icons.workspace_premium),
                title: Text(item.$1),
                subtitle: Text(item.$2),
                trailing: Text(item.$3,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
            );
          },
        ),
      ),
    );
  }
}
