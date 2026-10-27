import 'package:flutter/material.dart';
import '../../../core/networking/player_api_client.dart';

void showServerConfigDialog(BuildContext context) {
  final controller = TextEditingController(text: PlayerApiClientConfig.currentBaseUrl);
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: const Color(0xFF1E222D),
      title: const Text('Backend Server URL', style: TextStyle(color: Colors.white, fontSize: 16)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: controller,
            style: const TextStyle(color: Colors.white, fontSize: 14),
            decoration: const InputDecoration(
              labelText: 'API Base URL',
              labelStyle: TextStyle(color: Colors.white70),
              hintText: 'http://10.0.2.2:8080/api/v1',
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              ActionChip(
                label: const Text('Cloudflare Live (Auto)', style: TextStyle(fontSize: 12)),
                onPressed: () => controller.text = 'https://regulations-crimes-corrected-incomplete.trycloudflare.com/api/v1',
              ),
              ActionChip(
                label: const Text('Wi-Fi PC (192.168.18.7)', style: TextStyle(fontSize: 12)),
                onPressed: () => controller.text = 'http://192.168.18.7:8080/api/v1',
              ),
              ActionChip(
                label: const Text('Emulator (10.0.2.2)', style: TextStyle(fontSize: 12)),
                onPressed: () => controller.text = 'http://10.0.2.2:8080/api/v1',
              ),
            ],
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () {
            if (controller.text.trim().isNotEmpty) {
              PlayerApiClientConfig.setActiveBaseUrl(controller.text.trim());
            }
            Navigator.pop(ctx);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Server URL set to: ${PlayerApiClientConfig.currentBaseUrl}')),
            );
          },
          child: const Text('Save'),
        ),
      ],
    ),
  );
}

class AuthField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData icon;
  final TextInputType keyboardType;
  final bool obscureText;
  final Widget? suffix;
  final String? Function(String?)? validator;

  const AuthField({
    super.key,
    required this.controller,
    required this.label,
    required this.hint,
    required this.icon,
    this.keyboardType = TextInputType.text,
    this.obscureText = false,
    this.suffix,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      validator: validator,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: Icon(icon),
        suffixIcon: suffix,
      ),
    );
  }
}

class AuthHeader extends StatelessWidget {
  final String title;
  final String subtitle;

  const AuthHeader({
    super.key,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.asset(
                    'assets/branding/n5_crown_emblem.png',
                    width: 32,
                    height: 32,
                    fit: BoxFit.cover,
                  ),
                ),
                const SizedBox(width: 10),
                const Text(
                  'N5 GAME',
                  style: TextStyle(
                    color: Color(0xFFF5C542),
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 2,
                  ),
                ),
              ],
            ),
            IconButton(
              icon: const Icon(Icons.dns_outlined, size: 20, color: Colors.white54),
              tooltip: 'Server Connection',
              onPressed: () => showServerConfigDialog(context),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          title,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 28,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          subtitle,
          style: const TextStyle(
            color: Color(0xFFA8B0C0),
            fontSize: 14,
            height: 1.5,
          ),
        ),
      ],
    );
  }
}

class AuthButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool loading;

  const AuthButton({
    super.key,
    required this.text,
    required this.onPressed,
    this.loading = false,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: loading ? null : onPressed,
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Text(text),
      ),
    );
  }
}

String? requiredValue(String? value, String message) {
  if (value == null || value.trim().isEmpty) return message;
  return null;
}
