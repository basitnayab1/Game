import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import 'auth_ui.dart';

/// Without phone verification a player cannot prove ownership of the number,
/// so password resets go through support: support verifies the player and
/// issues a one-time password from the admin panel.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _phone = TextEditingController();
  late final Future<String?> _whatsapp = _loadSupport();

  Future<String?> _loadSupport() async {
    try {
      final r = await PlayerApiClient(PlayerApiClientConfig.fromEnvironment()).get('/app/support');
      return ((r.data as Map)['data'] as Map)['whatsapp'] as String?;
    } catch (_) {
      return null;
    }
  }

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _openWhatsApp(String number) async {
    final phone = _phone.text.trim();
    final text = 'Assalam o Alaikum, mujhe N5 Game ka password reset karna hai.'
        '${phone.isEmpty ? '' : ' Mera account number: $phone'}';
    final uri = Uri.parse('https://wa.me/${number.replaceAll(RegExp(r'[^0-9]'), '')}?text=${Uri.encodeComponent(text)}');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('WhatsApp par $number par rabta karein.')));
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
          title: const Text('Account Recovery'),
        ),
        body: FutureBuilder<String?>(
          future: _whatsapp,
          builder: (context, snap) {
            final number = snap.data;
            return ListView(
              padding: const EdgeInsets.fromLTRB(24, 30, 24, 24),
              children: [
                const AuthHeader(
                  title: 'Password bhool gaye?',
                  subtitle: 'Support se rabta karein. Tasdeeq ke baad support aap ko ek temporary password dega. '
                      'Us se login karke apna naya password rakhein.',
                ),
                const SizedBox(height: 24),
                AuthField(
                  controller: _phone,
                  label: 'Aap ka account phone number',
                  hint: '03XX XXXXXXX',
                  icon: Icons.phone_outlined,
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 22),
                if (snap.connectionState != ConnectionState.done)
                  const Center(child: CircularProgressIndicator())
                else if (number != null)
                  AuthButton(text: 'WhatsApp Support', onPressed: () => _openWhatsApp(number))
                else
                  const Text(
                    'App ke andar Support section se rabta karein.',
                    style: TextStyle(color: Color(0xFFA8B0C0)),
                  ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => N5Navigation.handleBack(context, fallbackRoute: AppRoutes.login),
                  child: const Text('Back to Login'),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
