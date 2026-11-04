import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/auth_repository.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/networking/player_api_client.dart';
import 'auth_ui.dart';

/// Shown after signing in with a temporary password from support: the player
/// must choose their own password before using the app. There is no way back.
class NewPasswordScreen extends StatefulWidget {
  const NewPasswordScreen({super.key});

  @override
  State<NewPasswordScreen> createState() => _NewPasswordScreenState();
}

class _NewPasswordScreenState extends State<NewPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _temporary = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _saving = false;
  final _auth = AuthRepository(PlayerApiClient(PlayerApiClientConfig.fromEnvironment()));

  @override
  void dispose() {
    _temporary.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await _auth.changePassword(_temporary.text.trim(), _password.text);
      if (!mounted) return;
      messenger.showSnackBar(const SnackBar(content: Text('Naya password set ho gaya.')));
      context.go(AppRoutes.home);
    } catch (e) {
      final body = e is DioException ? e.response?.data : null;
      final wrong = body is Map && body['error'] == 'CURRENT_PASSWORD_WRONG';
      messenger.showSnackBar(SnackBar(
        content: Text(wrong ? 'Temporary password ghalat hai.' : authErrorMessage(e)),
      ));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _logout() async {
    await _auth.logout().catchError((_) {});
    if (mounted) context.go(AppRoutes.login);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: const Text('Set New Password'),
          actions: [TextButton(onPressed: _saving ? null : _logout, child: const Text('Logout'))],
        ),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
            child: Form(
              key: _formKey,
              child: Column(
                children: [
                  const AuthHeader(
                    title: 'Naya password rakhein',
                    subtitle: 'Aap ne support ka diya hua temporary password istemal kiya hai. Aage barhne ke liye apna naya password chunein.',
                  ),
                  const SizedBox(height: 24),
                  AuthField(
                    controller: _temporary,
                    label: 'Temporary Password',
                    hint: 'N5-XXXX-XXXX',
                    icon: Icons.key_outlined,
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter the temporary password' : null,
                  ),
                  const SizedBox(height: 16),
                  AuthField(
                    controller: _password,
                    label: 'New Password',
                    hint: 'At least 8 characters',
                    icon: Icons.lock_outline_rounded,
                    obscureText: true,
                    validator: (v) => (v == null || v.length < 8) ? 'Password must be at least 8 characters' : null,
                  ),
                  const SizedBox(height: 16),
                  AuthField(
                    controller: _confirm,
                    label: 'Confirm New Password',
                    hint: 'Repeat the new password',
                    icon: Icons.lock_reset_outlined,
                    obscureText: true,
                    validator: (v) => v != _password.text ? 'Passwords do not match' : null,
                  ),
                  const SizedBox(height: 22),
                  AuthButton(text: _saving ? 'Saving...' : 'Save Password', loading: _saving, onPressed: _saving ? null : _save),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
