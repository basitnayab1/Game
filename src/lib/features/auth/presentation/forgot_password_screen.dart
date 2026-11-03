import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import 'auth_ui.dart';

/// Without phone verification a player cannot prove ownership of the number,
/// so password resets go through support instead of a self-service flow.
class ForgotPasswordScreen extends StatelessWidget {
  const ForgotPasswordScreen({super.key});

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
        body: Padding(
          padding: const EdgeInsets.fromLTRB(24, 30, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const AuthHeader(
                title: 'Password bhool gaye?',
                subtitle:
                    'Customer support se rabta karein. Account ki tasdeeq ke baad support aapka password reset kar dega.',
              ),
              const SizedBox(height: 22),
              AuthButton(
                text: 'Back to Login',
                onPressed: () => N5Navigation.handleBack(context,
                    fallbackRoute: AppRoutes.login),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
