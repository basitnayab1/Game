import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';

class GameCategoryScreen extends StatelessWidget {
  final String category;
  const GameCategoryScreen({super.key, required this.category});

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.home,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          backgroundColor: const Color(0xFF0B0F17),
          leading: const N5BackButton(fallbackRoute: AppRoutes.home),
          title: Text(category, style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 8,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: .92,
        ),
        itemBuilder: (context, index) {
          final name = '$category Game ${index + 1}';
          return InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => context.push(
              '${AppRoutes.gameDetail}?game=${Uri.encodeComponent(name)}',
            ),
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFF171E2B),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF293244)),
              ),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.casino_rounded, size: 48, color: Color(0xFF8B7CFF)),
                    const SizedBox(height: 10),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Text(
                        name,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    ));
  }
}
