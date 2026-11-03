import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import 'game_grid.dart';

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
        body: GameGrid(category: category),
      ),
    );
  }
}
