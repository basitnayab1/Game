import 'package:flutter/material.dart';
import '../../../core/localization/localization_service.dart';

class N5BottomNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onChanged;

  const N5BottomNavBar({super.key, required this.currentIndex, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final items = [
      (Icons.home_rounded, context.tr('home', defaultText: 'Home')),
      (Icons.local_offer_rounded, context.tr('promotions', defaultText: 'Promo')),
      (Icons.group_rounded, context.tr('invite', defaultText: 'Invite')),
      (Icons.support_agent_rounded, context.tr('support', defaultText: 'Support')),
      (Icons.person_rounded, context.tr('profile', defaultText: 'Profile')),
    ];

    return NavigationBar(
      selectedIndex: currentIndex,
      onDestinationSelected: onChanged,
      backgroundColor: const Color(0xFF111722),
      indicatorColor: const Color(0x336C5CE7),
      destinations: [
        for (final item in items)
          NavigationDestination(icon: Icon(item.$1), label: item.$2),
      ],
    );
  }
}
