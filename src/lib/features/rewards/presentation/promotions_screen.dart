import 'package:flutter/material.dart';

import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import '../data/rewards_api.dart';

class PromotionsScreen extends StatefulWidget {
  const PromotionsScreen({super.key});

  @override
  State<PromotionsScreen> createState() => _PromotionsScreenState();
}

class _PromotionsScreenState extends State<PromotionsScreen> {
  late final RewardsApi _api;
  late Future<List<PromotionItem>> _future;

  @override
  void initState() {
    super.initState();
    _api = RewardsApi(
      PlayerApiClient(PlayerApiClientConfig.fromEnvironment()),
    );
    _future = _api.promotions();
  }

  void _retry() => setState(() => _future = _api.promotions());

  Future<void> _open(PromotionItem promotion) async {
    try {
      await _api.activatePromotion(promotion.id);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(promotion.title),
          content: const Text(
            'Reward available. Press OPEN to reveal it.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Close'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(dialogContext);
                try {
                  await _api.openPromotion(promotion.id);
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Reward claimed successfully.')),
                  );
                  _retry();
                } catch (error) {
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Unable to open reward: $error')),
                  );
                }
              },
              child: const Text('OPEN'),
            ),
          ],
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unable to activate: $error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.home,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.home),
          title: const Text('Promotions'),
        ),
      body: FutureBuilder<List<PromotionItem>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: ElevatedButton(
                onPressed: _retry,
                child: const Text('Retry'),
              ),
            );
          }
          final promotions = snapshot.data ?? const <PromotionItem>[];
          if (promotions.isEmpty) {
            return const Center(child: Text('No active promotions'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: promotions.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final promotion = promotions[index];
              final claimed = promotion.claimStatus == 'claimed';
              return Card(
                child: ListTile(
                  leading: const CircleAvatar(
                    child: Icon(Icons.card_giftcard),
                  ),
                  title: Text(promotion.title),
                  subtitle: Text(
                    '${promotion.promotionType} • Ends ${promotion.endsAt}',
                  ),
                  trailing: claimed
                      ? const Text('Claimed')
                      : ElevatedButton(
                          onPressed: () => _open(promotion),
                          child: const Text('OPEN'),
                        ),
                ),
              );
            },
          );
        },
      ),
    ));
  }
}

class PromotionDetailScreen extends StatelessWidget {
  final String name;
  final String description;
  final String type;

  const PromotionDetailScreen({
    super.key,
    required this.name,
    required this.description,
    required this.type,
  });

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.promotions,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.promotions),
          title: const Text('Promotion Detail'),
        ),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.card_giftcard, size: 52),
                  const SizedBox(height: 16),
                  Text(
                    name,
                    style: const TextStyle(
                      fontSize: 23,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(description),
                  const SizedBox(height: 20),
                  Text('Type: $type'),
                  const SizedBox(height: 12),
                  const Text(
                    'Eligibility, validity and reward state are controlled by the server.',
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
