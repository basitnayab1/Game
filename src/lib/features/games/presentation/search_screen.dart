import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import 'game_grid.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final controller = TextEditingController();
  final recent = <String>[];
  String _query = '';

  void _search(String value) {
    final q = value.trim();
    if (q.isEmpty) return;
    controller.text = q;
    setState(() {
      _query = q;
      recent.remove(q);
      recent.insert(0, q);
    });
  }

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
          textInputAction: TextInputAction.search,
          onSubmitted: _search,
        ),
      ),
      body: ValueListenableBuilder<TextEditingValue>(
        valueListenable: controller,
        builder: (_, value, __) {
          if (value.text.trim().isEmpty || _query.isEmpty) {
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
                          onTap: () => _search(item),
                        ),
                      ),
                    ],
                  );
          }

          return GameGrid(key: ValueKey(_query), query: _query);
        },
      ),
    ));
  }
}
