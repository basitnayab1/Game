import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';

/// Player controls stored and enforced by the server: daily deposit and loss
/// limits, a short break, and self-exclusion.
class ResponsibleGamingScreen extends StatefulWidget {
  const ResponsibleGamingScreen({super.key});

  @override
  State<ResponsibleGamingScreen> createState() => _ResponsibleGamingScreenState();
}

class _ResponsibleGamingScreenState extends State<ResponsibleGamingScreen> {
  final _client = PlayerApiClient(PlayerApiClientConfig.fromEnvironment());
  Map<String, dynamic> _controls = const {};
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await _client.get('/responsible-gaming');
      _controls = Map<String, dynamic>.from((r.data as Map)['data'] as Map);
      _error = null;
    } catch (_) {
      _error = 'Could not load your controls.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save(Map<String, dynamic> change, String success) async {
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final r = await _client.patch('/responsible-gaming', data: change);
      setState(() => _controls = Map<String, dynamic>.from((r.data as Map)['data'] as Map));
      messenger.showSnackBar(SnackBar(content: Text(success)));
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('Could not save. Try again.')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _limitText(String key) {
    final v = _controls[key];
    return v == null ? 'No limit set' : 'Rs ${(num.parse('$v') / 100).toStringAsFixed(0)} per day';
  }

  DateTime? _until(String key) {
    final v = _controls[key];
    final t = v == null ? null : DateTime.tryParse('$v')?.toLocal();
    return t != null && t.isAfter(DateTime.now()) ? t : null;
  }

  String _date(DateTime t) =>
      '${t.year}-${t.month.toString().padLeft(2, '0')}-${t.day.toString().padLeft(2, '0')} '
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  Future<void> _editLimit(String key, String title) async {
    final controller = TextEditingController();
    final rupees = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: const InputDecoration(labelText: 'Amount per day (Rs)', prefixText: 'Rs '),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, int.tryParse(controller.text)),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (rupees == null) return;
    await _save({key: rupees * 100}, '$title saved.');
  }

  Future<void> _pause({required String key, required String title, required Map<String, Duration> options}) async {
    final choice = await showDialog<Duration>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: Text(title),
        children: [
          for (final e in options.entries)
            SimpleDialogOption(onPressed: () => Navigator.pop(ctx, e.value), child: Text(e.key)),
        ],
      ),
    );
    if (choice == null || !mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Are you sure?'),
        content: const Text(
          'You will not be able to play, deposit or spin the wheel until it ends. '
          'This cannot be shortened or cancelled.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirm')),
        ],
      ),
    );
    if (confirmed != true) return;
    await _save({key: DateTime.now().toUtc().add(choice).toIso8601String()}, '$title started.');
  }

  @override
  Widget build(BuildContext context) {
    final breakUntil = _until('takeABreakUntil');
    final excludedUntil = _until('selfExcludedUntil');

    return N5BackScope(
      fallbackRoute: AppRoutes.profile,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.profile),
          title: const Text('Responsible Gaming'),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: TextButton(onPressed: _load, child: Text('$_error Retry')))
                : AbsorbPointer(
                    absorbing: _saving,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        Container(
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primary.withOpacity(.12),
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: const Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('18+', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800)),
                              SizedBox(height: 6),
                              Text(
                                'Play for fun, only with money you can afford to lose. '
                                'These controls are enforced on our servers.',
                                style: TextStyle(height: 1.45),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 18),
                        const Text('Daily Limits', style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        _tile(
                          icon: Icons.account_balance_wallet_outlined,
                          title: 'Deposit Limit',
                          subtitle: _limitText('depositLimitMinor'),
                          onTap: () => _editLimit('depositLimitMinor', 'Deposit Limit'),
                        ),
                        _tile(
                          icon: Icons.trending_down_rounded,
                          title: 'Loss Limit',
                          subtitle: _limitText('lossLimitMinor'),
                          onTap: () => _editLimit('lossLimitMinor', 'Loss Limit'),
                        ),
                        const SizedBox(height: 18),
                        const Text('Account Controls', style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        _tile(
                          icon: Icons.pause_circle_outline,
                          title: 'Take a Break',
                          subtitle: breakUntil == null ? 'Pause your account for a short time' : 'On a break until ${_date(breakUntil)}',
                          onTap: () => _pause(
                            key: 'takeABreakUntil',
                            title: 'Take a Break',
                            options: const {
                              '24 hours': Duration(hours: 24),
                              '7 days': Duration(days: 7),
                              '30 days': Duration(days: 30),
                            },
                          ),
                        ),
                        _tile(
                          icon: Icons.block_outlined,
                          title: 'Self-Exclusion',
                          subtitle: excludedUntil == null ? 'Lock your account for a long time' : 'Self-excluded until ${_date(excludedUntil)}',
                          onTap: () => _pause(
                            key: 'selfExcludedUntil',
                            title: 'Self-Exclusion',
                            options: const {
                              '6 months': Duration(days: 182),
                              '1 year': Duration(days: 365),
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
      ),
    );
  }

  Widget _tile({required IconData icon, required String title, required String subtitle, required VoidCallback onTap}) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: Icon(icon),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
