import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/auth/auth_repository.dart';
import '../../../core/networking/player_api_client.dart';

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _smsController = TextEditingController();
  bool _loadingWhatsApp = false;
  bool _loadingSms = false;
  late final AuthRepository _auth;
  Timer? _statusPollTimer;

  @override
  void initState() {
    super.initState();
    _auth = AuthRepository(PlayerApiClient(PlayerApiClientConfig.fromEnvironment()));
    // Background polling for status in case WhatsApp message was sent externally
    _statusPollTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      if (mounted) {
        _checkVerificationStatus();
      }
    });
  }

  @override
  void dispose() {
    _statusPollTimer?.cancel();
    _smsController.dispose();
    super.dispose();
  }

  Future<void> _checkVerificationStatus() async {
    final challengeId = GoRouterState.of(context).uri.queryParameters['challenge'];
    if (challengeId == null || challengeId.isEmpty) return;

    try {
      final session = await _auth.checkOtpStatus(challengeId);
      if (session != null && mounted) {
        _statusPollTimer?.cancel();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF10B981),
            content: Text('Verification successful! Welcome to N5 Game.'),
          ),
        );
        context.go(AppRoutes.home);
      }
    } catch (_) {
      // Ignore background poll errors
    }
  }

  Future<void> _verifyViaWhatsApp(String link) async {
    final challengeId = GoRouterState.of(context).uri.queryParameters['challenge'];
    if (challengeId == null || challengeId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Verification session expired. Please try again.')),
      );
      return;
    }

    setState(() => _loadingWhatsApp = true);
    try {
      // 1. Launch WhatsApp with pre-filled message
      final uri = Uri.parse(link);
      try {
        final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
        if (!launched) {
          await launchUrl(uri, mode: LaunchMode.platformDefault);
        }
      } catch (_) {
        // Fallback: copy link to clipboard if WhatsApp app is not installed
        await Clipboard.setData(ClipboardData(text: link));
      }

      // 2. The server verifies the challenge when the WhatsApp message arrives from
      //    this phone number; the status poll then signs the player in.
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFF25D366),
          content: Text('Send the pre-filled WhatsApp message. You will be signed in automatically.'),
        ),
      );
      await _checkVerificationStatus();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('WhatsApp verification failed: $e')),
      );
    } finally {
      if (mounted) setState(() => _loadingWhatsApp = false);
    }
  }

  Future<void> _verifySms() async {
    if (_smsController.text.trim().length < 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter the 6-digit SMS verification code.')),
      );
      return;
    }
    final challengeId = GoRouterState.of(context).uri.queryParameters['challenge'];
    if (challengeId == null || challengeId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Verification session is missing. Please request a new code.')),
      );
      return;
    }
    setState(() => _loadingSms = true);
    try {
      await _auth.verifyOtp(challengeId, _smsController.text.trim());
      if (!mounted) return;
      _statusPollTimer?.cancel();
      context.go(AppRoutes.home);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Verification failed: $e')),
      );
    } finally {
      if (mounted) setState(() => _loadingSms = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final qParams = GoRouterState.of(context).uri.queryParameters;
    final phone = qParams['phone'] ?? '';
    String link = qParams['link'] ?? '';
    if (link.isEmpty) {
      link = 'https://wa.me/923076975507?text=VERIFY_N5';
    }

    return N5BackScope(
      fallbackRoute: AppRoutes.login,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.login),
          title: const Text('Phone Verification'),
          backgroundColor: Colors.transparent,
          elevation: 0,
        ),
        body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Verify Your Account',
                style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              Text(
                phone.isNotEmpty
                    ? 'Verify your number ($phone) to activate your account and access games.'
                    : 'Verify your phone number to activate your account and access games.',
                style: const TextStyle(color: Color(0xFFA8B0C0), fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 24),

              // Primary WhatsApp Verification Option
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: const Color(0xFF0C241B),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF25D366), width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF25D366).withOpacity(0.12),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF25D366),
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: const Icon(Icons.chat_bubble_rounded, color: Colors.black, size: 20),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Instant WhatsApp Verify',
                                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                              ),
                              SizedBox(height: 2),
                              Text(
                                '1-Click • 100% Free • Anti-Ban',
                                style: TextStyle(color: Color(0xFF34D399), fontSize: 11, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Click below to verify your number directly on WhatsApp and login to your account immediately.',
                      style: TextStyle(color: Color(0xFFD1D5DB), fontSize: 12.5, height: 1.4),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      height: 50,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF25D366),
                          foregroundColor: Colors.black,
                          elevation: 2,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        icon: _loadingWhatsApp
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.black),
                              )
                            : const Icon(Icons.verified_user_rounded, size: 20),
                        label: Text(
                          _loadingWhatsApp ? 'Verifying on WhatsApp...' : 'Verify on WhatsApp',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                        ),
                        onPressed: _loadingWhatsApp ? null : () => _verifyViaWhatsApp(link),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              // Alternative SMS Divider
              Row(
                children: [
                  Expanded(child: Divider(color: Colors.white.withOpacity(0.12))),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text(
                      'Or enter SMS verification code',
                      style: TextStyle(color: Colors.white.withOpacity(0.45), fontSize: 12),
                    ),
                  ),
                  Expanded(child: Divider(color: Colors.white.withOpacity(0.12))),
                ],
              ),

              const SizedBox(height: 20),

              // SMS Manual Input Field
              TextField(
                controller: _smsController,
                keyboardType: TextInputType.number,
                maxLength: 6,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 24, letterSpacing: 8, fontWeight: FontWeight.bold),
                decoration: InputDecoration(
                  counterText: '',
                  hintText: '••••••',
                  hintStyle: TextStyle(color: Colors.white.withOpacity(0.2), letterSpacing: 8),
                  filled: true,
                  fillColor: const Color(0xFF131B26),
                  contentPadding: const EdgeInsets.symmetric(vertical: 14),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: Color(0xFF25D366), width: 1.5),
                  ),
                ),
              ),

              const SizedBox(height: 14),

              // SMS Verify Button
              SizedBox(
                height: 46,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: Colors.white.withOpacity(0.25)),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: _loadingSms ? null : _verifySms,
                  child: _loadingSms
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Verify SMS Code', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                ),
              ),

              const SizedBox(height: 20),

              // Change Phone Number
              Center(
                child: TextButton(
                  onPressed: () => context.pop(),
                  child: Text(
                    'Change phone number',
                    style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 13),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
    );
  }
}
