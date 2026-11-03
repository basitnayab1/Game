import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../../../core/auth/auth_repository.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import '../data/security_api.dart';

class SecurityDevicesScreen extends StatelessWidget {
  const SecurityDevicesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.profile,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.profile),
          title: const Text('Security & Devices'),
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _securityStatus(),
            const SizedBox(height: 16),
            Card(
              child: ListTile(
                leading: const Icon(Icons.lock_outline),
                title: const Text('Change Password'),
                subtitle: const Text('Update your account password'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const ChangePasswordScreen()),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Card(
              child: ListTile(
                leading: const Icon(Icons.logout),
                title: const Text('Logout Other Devices'),
                subtitle: const Text('Sign out everywhere except this phone'),
                onTap: () => _confirmLogout(context),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _securityStatus() {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(18),
        child: Row(
          children: [
            Icon(Icons.verified_user_outlined, size: 36),
            SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Security Status', style: TextStyle(fontWeight: FontWeight.w600)),
                  SizedBox(height: 5),
                  Text('Account protected', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  SizedBox(height: 5),
                  Text(
                    'Login locks for 1 minute after 3 wrong passwords.',
                    style: TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmLogout(BuildContext context) {
    final messenger = ScaffoldMessenger.of(context);
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Logout Other Devices?'),
        content: const Text('Every other phone signed in to this account will be signed out.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(dialogContext);
              try {
                final count = await SecurityApi(PlayerApiClient(PlayerApiClientConfig.fromEnvironment())).revokeOtherSessions();
                messenger.showSnackBar(SnackBar(content: Text('Signed out $count other session(s).')));
              } catch (_) {
                messenger.showSnackBar(const SnackBar(content: Text('Could not sign out other devices. Try again.')));
              }
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }
}

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await AuthRepository(PlayerApiClient(PlayerApiClientConfig.fromEnvironment()))
          .changePassword(_current.text, _next.text);
      if (!mounted) return;
      messenger.showSnackBar(const SnackBar(content: Text('Password updated. Other devices were signed out.')));
      Navigator.pop(context);
    } catch (e) {
      final wrong = e is DioException && (e.response?.data is Map) && (e.response!.data as Map)['error'] == 'CURRENT_PASSWORD_WRONG';
      messenger.showSnackBar(SnackBar(
        content: Text(wrong ? 'Current password is wrong.' : authErrorMessage(e)),
      ));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.security,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.security),
          title: const Text('Change Password'),
        ),
        body: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextFormField(
                controller: _current,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Current Password', border: OutlineInputBorder()),
                validator: (v) => (v == null || v.isEmpty) ? 'Enter your current password' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _next,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'New Password', border: OutlineInputBorder()),
                validator: (v) => (v == null || v.length < 8) ? 'Password must be at least 8 characters' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _confirm,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Confirm New Password', border: OutlineInputBorder()),
                validator: (v) => v != _next.text ? 'Passwords do not match' : null,
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: _saving ? null : _save,
                child: Text(_saving ? 'Updating...' : 'Update Password'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
