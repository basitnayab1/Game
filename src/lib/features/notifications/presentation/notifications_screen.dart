import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import '../data/notifications_api.dart';

enum NotificationType { all, transactions, promotions, security, system }

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late final NotificationsApi _api;
  NotificationType _filter = NotificationType.all;
  List<Map<String, dynamic>> _items = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _api = NotificationsApi(PlayerApiClient(PlayerApiClientConfig.fromEnvironment()));
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final result = await _api.list();
      if (!mounted) return;
      setState(() { _items = result; _error = null; });
    } catch (_) {
      if (mounted) setState(() => _error = 'Unable to load notifications. Please retry.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _label(NotificationType type) {
    switch (type) {
      case NotificationType.all: return 'All';
      case NotificationType.transactions: return 'Transactions';
      case NotificationType.promotions: return 'Promotions';
      case NotificationType.security: return 'Security';
      case NotificationType.system: return 'System';
    }
  }

  bool _matches(Map<String, dynamic> item) {
    if (_filter == NotificationType.all) return true;
    final category = (item['category'] ?? 'SYSTEM').toString().toUpperCase();
    final expected = _filter.name == 'transactions'
        ? 'TRANSACTION'
        : _filter.name == 'promotions' ? 'PROMOTION' : _filter.name.toUpperCase();
    return category == expected;
  }

  @override
  Widget build(BuildContext context) {
    final shown = _items.where(_matches).toList();
    final unread = _items.where((item) => item['read_at'] == null).length;
    return N5BackScope(
      fallbackRoute: AppRoutes.home,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.home),
          title: Text('Notifications${unread > 0 ? ' ($unread)' : ''}'),
          actions: [
            if (unread > 0)
              TextButton(
                onPressed: () async { await _api.markAllRead(); await _load(); },
                child: const Text('Read all'),
              ),
          ],
        ),
        body: _buildBody(context, shown),
      ),
    );
  }

  Widget _buildBody(BuildContext context, List<Map<String, dynamic>> shown) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(_error!),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: _load, child: const Text('Retry')),
      ]));
    }
    return Column(
      children: [
        SizedBox(
          height: 52,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            scrollDirection: Axis.horizontal,
            itemCount: NotificationType.values.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final type = NotificationType.values[index];
              return ChoiceChip(
                label: Text(_label(type)),
                selected: _filter == type,
                onSelected: (_) => setState(() => _filter = type),
              );
            },
          ),
        ),
        Expanded(
          child: shown.isEmpty
              ? const Center(child: Text('No notifications'))
              : ListView.separated(
                  itemCount: shown.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final item = shown[index];
                    final read = item['read_at'] != null;
                    return ListTile(
                      title: Text(
                        '${item['title'] ?? ''}',
                        style: TextStyle(fontWeight: read ? FontWeight.normal : FontWeight.bold),
                      ),
                      subtitle: Text('${item['body'] ?? ''}\n${item['created_at'] ?? ''}'),
                      isThreeLine: true,
                      onTap: () async {
                        if (!read) {
                          await _api.markRead('${item['id']}');
                          await _load();
                        }
                      },
                    );
                  },
                ),
        ),
      ],
    );
  }
}
