import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';

class RewardHistoryScreen extends StatelessWidget {
  const RewardHistoryScreen({super.key});

  static const history = [
    ('Daily Reward', 'PKR 100', 'Claimed', '02 Oct 2026'),
    ('Weekly Bonus', 'PKR 500', 'Claimed', '29 Sep 2026'),
    ('Monthly Bonus', 'PKR 2,000', 'Expired', '31 Aug 2026'),
    ('Referral Reward', 'PKR 500', 'Pending', '28 Sep 2026'),
  ];

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.promotions,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.promotions),
          title: const Text('Reward History'),
        ),
        body: ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: history.length,
          itemBuilder: (_, index) {
            final item = history[index];
            return Card(
              child: ListTile(
                leading: const Icon(Icons.card_giftcard),
                title: Text(item.$1),
                subtitle: Text('${item.$4} • ${item.$3}'),
                trailing: Text(item.$2,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
            );
          },
        ),
      ),
    );
  }
}
