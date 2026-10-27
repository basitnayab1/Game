import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';

class ProviderLobbyScreen extends StatelessWidget {
  const ProviderLobbyScreen({super.key});

  static const providers = [
    ('Authorized Provider 01', '24 games'),
    ('Authorized Provider 02', '18 games'),
    ('Authorized Provider 03', '31 games'),
    ('Authorized Provider 04', '12 games'),
  ];

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.home,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          backgroundColor: const Color(0xFF0B0F17),
          leading: const N5BackButton(fallbackRoute: AppRoutes.home),
          title: const Text('Providers', style: TextStyle(fontWeight: FontWeight.w800)),
        ),
        body: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: providers.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, index) {
            final provider = providers[index];
            return ListTile(
              tileColor: const Color(0xFF171E2B),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              leading: const CircleAvatar(
                backgroundColor: Color(0xFF242C3B),
                child: Icon(Icons.business_rounded, color: Color(0xFF8B7CFF)),
              ),
              title: Text(provider.$1, style: const TextStyle(color: Colors.white)),
              subtitle: Text(provider.$2, style: const TextStyle(color: Color(0xFFA8B0C0))),
              trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFFA8B0C0)),
              onTap: () {},
            );
          },
        ),
      ),
    );
  }
}
