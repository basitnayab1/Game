
import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import '../data/support_api.dart';

class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});

  static const categories = [
    'Deposit',
    'Withdrawal',
    'Account',
    'KYC',
    'Game',
    'Promotion',
    'Security',
    'Other',
  ];

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.home,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.home),
          title: const Text('Support'),
        ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text('How can we help?',
                      style:
                          TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                  SizedBox(height: 6),
                  Text('Choose a category or create a support ticket.'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          ...categories.map(
            (category) => Card(
              child: ListTile(
                leading: const Icon(Icons.support_agent_outlined),
                title: Text(category),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) =>
                        CreateTicketScreen(category: category),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Card(
            child: ListTile(
              leading: const Icon(Icons.confirmation_number_outlined),
              title: const Text('My Tickets'),
              subtitle: const Text('View your support requests'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const MyTicketsScreen()),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Card(
            child: ListTile(
              leading: const Icon(Icons.chat_outlined),
              title: const Text('Live Support'),
              subtitle: const Text('Available if enabled for your region/account'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const LiveSupportScreen()),
              ),
            ),
          ),
        ],
      ),
    ));
  }
}

class CreateTicketScreen extends StatefulWidget {
  final String category;

  const CreateTicketScreen({super.key, required this.category});

  @override
  State<CreateTicketScreen> createState() => _CreateTicketScreenState();
}

class _CreateTicketScreenState extends State<CreateTicketScreen> {
  final subject = TextEditingController();
  final message = TextEditingController();
  bool sending = false;

  @override
  void dispose() {
    subject.dispose();
    message.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.support,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.support),
          title: const Text('Create Ticket'),
        ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.category_outlined),
            title: const Text('Category'),
            subtitle: Text(widget.category),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: subject,
            decoration: const InputDecoration(
              labelText: 'Subject',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: message,
            maxLines: 7,
            decoration: const InputDecoration(
              labelText: 'Describe your issue',
              alignLabelWithHint: true,
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: sending ? null : () async {
              if (subject.text.trim().isEmpty || message.text.trim().isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Subject and message are required.'))); return;
              }
              setState(() => sending = true);
              try {
                await SupportApi(PlayerApiClient(PlayerApiClientConfig.fromEnvironment())).create(category: widget.category, subject: subject.text, message: message.text);
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ticket created.')));
                Navigator.pop(context);
              } catch (_) {
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Unable to create ticket. Please retry.')));
              } finally {
                if (mounted) setState(() => sending = false);
              }
            },
            child: const Text('Create Ticket'),
          ),
          const SizedBox(height: 10),
          const Text(
            'Production: ticket creation, attachments, status and assignment '
            'must be processed by the backend.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey, fontSize: 12),
          ),
        ],
      ),
    ));
  }
}

class MyTicketsScreen extends StatelessWidget {
  const MyTicketsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.support,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.support),
          title: const Text('My Tickets'),
        ),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'No support tickets yet.\nYour tickets will appear here.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}

class LiveSupportScreen extends StatelessWidget {
  const LiveSupportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.support,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.support),
          title: const Text('Live Support'),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: const [
                Icon(Icons.support_agent, size: 56),
                SizedBox(height: 14),
                Text(
                  'Live support availability is controlled by the backend '
                  'and support configuration.',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
