import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import 'auth_ui.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _phone = TextEditingController();
  final _otp = TextEditingController();
  final _newPassword = TextEditingController();
  int _step = 0;

  @override
  void dispose() {
    _phone.dispose();
    _otp.dispose();
    _newPassword.dispose();
    super.dispose();
  }

  void _handleBack() {
    if (_step > 0) {
      setState(() => _step--);
    } else {
      N5Navigation.handleBack(context, fallbackRoute: AppRoutes.login);
    }
  }

  void _next() {
    if (_step == 0 && _phone.text.trim().isEmpty) return;
    if (_step == 1 && _otp.text.trim().length < 4) return;
    if (_step == 2 && _newPassword.text.length < 8) return;

    if (_step < 2) {
      setState(() => _step++);
    } else {
      // Production: backend resets password, invalidates prior sessions and applies security policy.
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password reset request completed.')));
      context.go(AppRoutes.login);
    }
  }

  @override
  Widget build(BuildContext context) {
    final titles = ['Forgot password', 'Verify code', 'Create new password'];
    final subtitles = [
      'Enter your verified phone number to receive a code.',
      'Enter the verification code sent to your phone.',
      'Choose a new secure password for your account.',
    ];

    return N5BackScope(
      onBack: _handleBack,
      fallbackRoute: AppRoutes.login,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          leading: N5BackButton(
            onPressed: _handleBack,
            fallbackRoute: AppRoutes.login,
          ),
          title: const Text('Account Recovery'),
        ),
        body: Padding(
          padding: const EdgeInsets.fromLTRB(24, 30, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AuthHeader(title: titles[_step], subtitle: subtitles[_step]),
              const SizedBox(height: 30),
              if (_step == 0)
                AuthField(controller: _phone, label: 'Phone Number', hint: 'Enter your verified phone', icon: Icons.phone_outlined, keyboardType: TextInputType.phone)
              else if (_step == 1)
                AuthField(controller: _otp, label: 'Verification Code', hint: 'Enter code', icon: Icons.pin_outlined, keyboardType: TextInputType.number)
              else
                AuthField(controller: _newPassword, label: 'New Password', hint: 'At least 8 characters', icon: Icons.lock_outline_rounded, obscureText: true),
              const SizedBox(height: 22),
              AuthButton(text: _step == 2 ? 'Reset Password' : 'Continue', onPressed: _next),
            ],
          ),
        ),
      ),
    );
  }
}
