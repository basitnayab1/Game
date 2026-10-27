import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';

class DailyRewardsScreen extends StatefulWidget {
  const DailyRewardsScreen({super.key});

  @override
  State<DailyRewardsScreen> createState() => _DailyRewardsScreenState();
}

class _DailyRewardsScreenState extends State<DailyRewardsScreen> {
  bool claimedToday = false;

  final days = const [
    ('Day 1', 'Available'),
    ('Day 2', 'Locked'),
    ('Day 3', 'Locked'),
    ('Day 4', 'Locked'),
    ('Day 5', 'Locked'),
    ('Day 6', 'Locked'),
    ('Day 7', 'Locked'),
  ];

  void _claim() {
    if (claimedToday) return;
    setState(() => claimedToday = true);
    showDialog(
      context: context,
      builder: (_) => RewardOpenDialog(
        rewardTitle: 'Daily Reward',
        rewardText: 'PKR 100',
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
          title: const Text('Daily Rewards'),
        ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('7-Day Reward Calendar',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          ...days.asMap().entries.map((entry) {
            final i = entry.key;
            final item = entry.value;
            final available = i == 0 && !claimedToday;
            final status = claimedToday && i == 0 ? 'Claimed' : item.$2;
            return Card(
              child: ListTile(
                leading: CircleAvatar(child: Text('${i + 1}')),
                title: Text(item.$1),
                subtitle: Text(status),
                trailing: available
                    ? ElevatedButton(onPressed: _claim, child: const Text('Claim'))
                    : const Icon(Icons.lock_outline),
              ),
            );
          }),
          const SizedBox(height: 18),
          const Text(
            'Rewards expire according to the configured claim period. Eligibility is checked by the backend.',
            style: TextStyle(fontSize: 12, color: Color(0xFFA8B0C0)),
          ),
        ],
      ),
    ));
  }
}

class RewardOpenDialog extends StatelessWidget {
  final String rewardTitle;
  final String rewardText;

  const RewardOpenDialog({
    super.key,
    required this.rewardTitle,
    required this.rewardText,
  });

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(rewardTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.card_giftcard, size: 70),
          const SizedBox(height: 12),
          const Text('Reward Available',
              style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(rewardText,
              style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w800)),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Close'),
        ),
        ElevatedButton(
          onPressed: () {
            Navigator.pop(context);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Reward claim requested.')),
            );
          },
          child: const Text('Claim'),
        ),
      ],
    );
  }
}
