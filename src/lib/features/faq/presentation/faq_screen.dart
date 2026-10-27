import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';

class FaqItem {
  final String category;
  final String question;
  final String answer;

  const FaqItem({
    required this.category,
    required this.question,
    required this.answer,
  });
}

class FaqScreen extends StatefulWidget {
  const FaqScreen({super.key});

  @override
  State<FaqScreen> createState() => _FaqScreenState();
}

class _FaqScreenState extends State<FaqScreen> {
  final searchController = TextEditingController();
  String selectedCategory = 'All';

  static const categories = [
    'All',
    'Account',
    'Wallet',
    'Deposit',
    'Withdrawal',
    'Games',
    'Promotions',
    'VIP',
    'Referral',
    'Security',
    'Responsible Gaming',
  ];

  static const faqItems = [
    FaqItem(
      category: 'Account',
      question: 'How do I create an account?',
      answer: 'Use the Register option and complete the required verification steps.',
    ),
    FaqItem(
      category: 'Wallet',
      question: 'Where can I view my balance?',
      answer: 'Your available balance and applicable wallet components are shown in Wallet.',
    ),
    FaqItem(
      category: 'Deposit',
      question: 'How is a deposit confirmed?',
      answer: 'A deposit is credited only after the approved payment provider confirms the transaction.',
    ),
    FaqItem(
      category: 'Withdrawal',
      question: 'How can I check a withdrawal?',
      answer: 'Open Withdrawal Status or Transaction History to view its current status.',
    ),
    FaqItem(
      category: 'Games',
      question: 'Why can a game be unavailable?',
      answer: 'Game availability can depend on provider status, account eligibility, region and configuration.',
    ),
    FaqItem(
      category: 'Promotions',
      question: 'Where can I see available promotions?',
      answer: 'Open Promotions to view currently available campaigns and their conditions.',
    ),
    FaqItem(
      category: 'VIP',
      question: 'Where can I view my VIP level?',
      answer: 'Open VIP Center to view your current level, progress and configured benefits.',
    ),
    FaqItem(
      category: 'Referral',
      question: 'Where can I find my referral code?',
      answer: 'Open Referral to view your current referral code and sharing options.',
    ),
    FaqItem(
      category: 'Security',
      question: 'How can I secure my account?',
      answer: 'Use a strong password, verification controls and review active devices regularly.',
    ),
    FaqItem(
      category: 'Responsible Gaming',
      question: 'Where are responsible-use controls?',
      answer: 'Open Responsible Gaming from Profile or Settings to review available controls and information.',
    ),
  ];

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  List<FaqItem> get filteredItems {
    final query = searchController.text.trim().toLowerCase();

    return faqItems.where((item) {
      final categoryMatch =
          selectedCategory == 'All' || item.category == selectedCategory;
      final textMatch = query.isEmpty ||
          item.question.toLowerCase().contains(query) ||
          item.answer.toLowerCase().contains(query) ||
          item.category.toLowerCase().contains(query);
      return categoryMatch && textMatch;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final items = filteredItems;

    return N5BackScope(
      fallbackRoute: AppRoutes.support,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.support),
          title: const Text('FAQ'),
        ),
        body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: searchController,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: 'Search FAQs',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: searchController.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        searchController.clear();
                        setState(() {});
                      },
                    ),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 42,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, index) {
                final category = categories[index];
                final selected = selectedCategory == category;

                return ChoiceChip(
                  label: Text(category),
                  selected: selected,
                  onSelected: (_) =>
                      setState(() => selectedCategory = category),
                );
              },
            ),
          ),
          const SizedBox(height: 16),
          if (items.isEmpty)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Column(
                children: [
                  Icon(Icons.search_off, size: 48),
                  SizedBox(height: 12),
                  Text(
                    'No FAQs found.',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Try another search or category.',
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            )
          else
            ...items.map(
              (item) => Card(
                child: ExpansionTile(
                  title: Text(item.question),
                  subtitle: Text(item.category),
                  childrenPadding:
                      const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  children: [
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(item.answer),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 12),
          const Text(
            'FAQ content is configurable from the backend/Admin Panel in production.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey, fontSize: 12),
          ),
        ],
      ),
    ),
    );
  }
}
