import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'auth_ui.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/country/country_config.dart';
import '../../../core/country/country_picker_sheet.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/auth/auth_repository.dart';
import '../../../core/networking/player_api_client.dart';
import '../../../core/localization/localization_service.dart';
import '../../localization/presentation/language_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phone = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  bool _codeLogin = false;
  final _auth = AuthRepository(PlayerApiClient(PlayerApiClientConfig.fromEnvironment()));

  @override
  void dispose() {
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (_phone.text.trim().isEmpty) return;
    if (!_codeLogin && _password.text.length < 8) return;
    setState(() => _loading = true);

    final country = CountryService.active;
    String fullPhone = _phone.text.trim();
    if (!fullPhone.startsWith('+')) {
      if (country.dialCode != '+' && fullPhone.startsWith('0')) {
        fullPhone = fullPhone.substring(1);
      }
      if (country.dialCode != '+') {
        fullPhone = '${country.dialCode}$fullPhone';
      }
    }

    try {
      if (_codeLogin) {
        final challenge = await _auth.requestOtp(fullPhone);
        if (!mounted) return;
        context.push('${AppRoutes.otp}?challenge=${Uri.encodeComponent(challenge.challengeId)}&link=${Uri.encodeComponent(challenge.antiBanLink ?? '')}&phone=${Uri.encodeComponent(fullPhone)}');
        return;
      }
      await _auth.login(fullPhone, _password.text);
      if (!mounted) return;
      context.go(AppRoutes.home);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Login failed: $e'),
        action: SnackBarAction(
          label: 'Server IP',
          textColor: const Color(0xFFF5C542),
          onPressed: () => showServerConfigDialog(context),
        ),
      ));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return N5LobbyBackScope(
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          leading: context.canPop() ? const N5BackButton() : null,
          backgroundColor: Colors.transparent,
          elevation: 0,
          title: Text(context.tr('login', defaultText: 'Login')),
          actions: [
            IconButton(
              icon: const Icon(Icons.language_rounded, color: Color(0xFFF5C542)),
              tooltip: context.tr('select_language', defaultText: 'Language'),
              onPressed: () => showLanguagePickerSheet(context),
            ),
          ],
        ),
        body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AuthHeader(
                title: context.tr('welcome_title', defaultText: 'Welcome back'),
                subtitle: context.tr('welcome_subtitle', defaultText: 'Sign in securely to your N5 Game account.'),
              ),
              const SizedBox(height: 22),
              ValueListenableBuilder<CountryConfig>(
                valueListenable: CountryService.countryNotifier,
                builder: (context, country, _) {
                  return Column(
                    children: [
                      CountrySelectorCard(
                        country: country,
                        onTap: () => showCountryPickerSheet(context),
                      ),
                      const SizedBox(height: 14),
                      AuthField(
                        controller: _phone,
                        label: '${context.tr('phone_number', defaultText: 'Phone Number')} (${country.dialCode})',
                        hint: country.phoneHint,
                        icon: Icons.phone_outlined,
                        keyboardType: TextInputType.phone,
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 14),
              if (!_codeLogin)
                AuthField(
                  controller: _password,
                  label: context.tr('password', defaultText: 'Password'),
                  hint: context.tr('enter_password', defaultText: 'Enter your password'),
                  icon: Icons.lock_outline_rounded,
                  obscureText: _obscure,
                  suffix: IconButton(
                    onPressed: () => setState(() => _obscure = !_obscure),
                    icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                  ),
                ),
              const SizedBox(height: 18),
              AuthButton(
                text: _loading
                    ? context.tr('loading', defaultText: 'Signing in...')
                    : (_codeLogin ? 'Send Verification Code' : context.tr('login', defaultText: 'Login')),
                loading: _loading,
                onPressed: _loading ? null : _login,
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: _loading ? null : () => setState(() => _codeLogin = !_codeLogin),
                child: Text(_codeLogin ? 'Use password login' : 'Login with verification code'),
              ),
              if (!_codeLogin)
                TextButton(
                  onPressed: _loading ? null : () => context.push(AppRoutes.forgotPassword),
                  child: Text(context.tr('forgot_password', defaultText: 'Forgot password?')),
                ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: _loading ? null : () => context.push(AppRoutes.register),
                child: Text(context.tr('sign_up', defaultText: 'Create new account')),
              ),
            ],
          ),
        ),
      ),
    ),
    );
  }
}
