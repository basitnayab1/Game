import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final controller = TextEditingController();
  final recent = <String>[];

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.home,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          backgroundColor: const Color(0xFF0B0F17),
          leading: const N5BackButton(fallbackRoute: AppRoutes.home),
          title: TextField(
          controller: controller,
          autofocus: true,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            hintText: 'Search games or providers',
            hintStyle: const TextStyle(color: Color(0xFF6F7889)),
            border: InputBorder.none,
          ),
          onSubmitted: (value) {
            if (value.trim().isNotEmpty) {
              setState(() => recent.insert(0, value.trim()));
            }
          },
        ),
      ),
      body: ValueListenableBuilder<TextEditingValue>(
        valueListenable: controller,
        builder: (_, value, __) {
          final query = value.text.trim().toLowerCase();
          if (query.isEmpty) {
            return recent.isEmpty
                ? const Center(
                    child: Text(
                      'Search for a game or provider',
                      style: TextStyle(color: Color(0xFFA8B0C0)),
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      const Text(
                        'Recent Searches',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 10),
                      ...recent.map(
                        (item) => ListTile(
                          leading: const Icon(
                            Icons.history_rounded,
                            color: Color(0xFFA8B0C0),
                          ),
                          title: Text(
                            item,
                            style: const TextStyle(color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  );
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                'Results for "$query"',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 12),
              for (int i = 1; i <= 5; i++)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const CircleAvatar(
                    backgroundColor: Color(0xFF171E2B),
                    child: Icon(Icons.casino_rounded, color: Color(0xFF8B7CFF)),
                  ),
                  title: Text(
                    'Game $i',
                    style: const TextStyle(color: Colors.white),
                  ),
                  subtitle: const Text(
                    'Authorized Provider',
                    style: TextStyle(color: Color(0xFFA8B0C0)),
                  ),
                  onTap: () {},
                ),
            ],
          );
        },
      ),
    ));
  }
}
