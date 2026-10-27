import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/country/country_config.dart';
import '../../../core/country/country_picker_sheet.dart';
import '../../../core/navigation/n5_navigation.dart';
import 'auth_ui.dart';
import '../../../core/auth/auth_repository.dart';
import '../../../core/networking/player_api_client.dart';
import '../../../core/localization/localization_service.dart';
import '../../localization/presentation/language_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phone = TextEditingController();
  final _dob = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  final _referral = TextEditingController();
  bool _accepted = false;
  bool _obscure = true;
  bool _loading = false;
  final _auth = AuthRepository(PlayerApiClient(PlayerApiClientConfig.fromEnvironment()));

  @override
  void dispose() {
    _phone.dispose();
    _dob.dispose();
    _password.dispose();
    _confirm.dispose();
    _referral.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_accepted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please accept the Terms and Conditions.')),
      );
      return;
    }
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
      await _auth.register(phone: fullPhone, dob: _dob.text.trim(), password: _password.text);
    } on RegistrationNeedsOtp catch (e) {
      if (!mounted) return;
      context.push('${AppRoutes.otp}?challenge=${Uri.encodeComponent(e.challengeId)}&link=${Uri.encodeComponent(e.antiBanLink ?? '')}&phone=${Uri.encodeComponent(fullPhone)}');
    } catch (e) {
      if (!mounted) return;
      final rawStr = e.toString();
      final isAlreadyRegistered = rawStr.contains('PHONE_ALREADY_REGISTERED') || rawStr.contains('already registered');
      final displayMsg = isAlreadyRegistered
          ? 'Yeh number pehle se registered hai! 1 number par sirf 1 account ban sakta hai.'
          : 'Registration failed: $e';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(displayMsg),
        backgroundColor: isAlreadyRegistered ? const Color(0xFFEF4444) : null,
        action: isAlreadyRegistered
            ? SnackBarAction(
                label: 'Login',
                textColor: Colors.white,
                onPressed: () => context.push(AppRoutes.login),
              )
            : SnackBarAction(
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
    return N5BackScope(
      fallbackRoute: AppRoutes.login,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.login),
          title: Text(context.tr('register', defaultText: 'Create Account')),
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
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
          child: Form(
            key: _formKey,
            child: Column(
              children: [
                const AuthHeader(
                  title: 'Join N5 Game',
                  subtitle: 'Create your account. Eligibility and age requirements are verified by the backend.',
                ),
                const SizedBox(height: 24),
                ValueListenableBuilder<CountryConfig>(
                  valueListenable: CountryService.countryNotifier,
                  builder: (context, country, _) {
                    return Column(
                      children: [
                        CountrySelectorCard(
                          country: country,
                          onTap: () => showCountryPickerSheet(context),
                        ),
                        const SizedBox(height: 16),
                        AuthField(
                          controller: _phone,
                          label: 'Phone Number (${country.dialCode})',
                          hint: country.phoneHint,
                          icon: Icons.phone_outlined,
                          keyboardType: TextInputType.phone,
                          validator: (v) => requiredValue(v, 'Enter your phone number'),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 16),
                AuthField(
                  controller: _dob,
                  label: 'Date of Birth',
                  hint: 'YYYY-MM-DD',
                  icon: Icons.cake_outlined,
                  keyboardType: TextInputType.datetime,
                  validator: (v) => requiredValue(v, 'Enter your date of birth'),
                ),
                const SizedBox(height: 16),
                AuthField(
                  controller: _password,
                  label: 'Password',
                  hint: 'Create a password',
                  icon: Icons.lock_outline_rounded,
                  obscureText: _obscure,
                  suffix: IconButton(
                    onPressed: () => setState(() => _obscure = !_obscure),
                    icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                  ),
                  validator: (v) {
                    if (v == null || v.length < 8) return 'Password must be at least 8 characters';
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                AuthField(
                  controller: _confirm,
                  label: 'Confirm Password',
                  hint: 'Repeat your password',
                  icon: Icons.lock_reset_outlined,
                  obscureText: true,
                  validator: (v) => v != _password.text ? 'Passwords do not match' : null,
                ),
                const SizedBox(height: 16),
                AuthField(
                  controller: _referral,
                  label: 'Referral Code (Optional)',
                  hint: 'Enter referral code',
                  icon: Icons.card_giftcard_outlined,
                ),
                const SizedBox(height: 8),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _accepted,
                  onChanged: (v) => setState(() => _accepted = v ?? false),
                  controlAffinity: ListTileControlAffinity.leading,
                  title: const Text(
                    'I confirm that I meet the applicable age requirements and agree to the Terms, Privacy Policy and Responsible Gaming rules.',
                    style: TextStyle(color: Color(0xFFA8B0C0), fontSize: 12, height: 1.4),
                  ),
                ),
                const SizedBox(height: 12),
                AuthButton(text: _loading ? 'Creating...' : 'Create Account', loading: _loading, onPressed: _loading ? null : _register),
              ],
            ),
          ),
        ),
      ),
    ),
    );
  }
}
