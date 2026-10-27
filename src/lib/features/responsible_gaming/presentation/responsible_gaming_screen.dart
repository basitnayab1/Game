import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';

class ResponsibleGamingScreen extends StatefulWidget {
  const ResponsibleGamingScreen({super.key});

  @override
  State<ResponsibleGamingScreen> createState() =>
      _ResponsibleGamingScreenState();
}

class _ResponsibleGamingScreenState extends State<ResponsibleGamingScreen> {
  bool _sessionReminder = false;
  bool _selfExclusion = false;

  void _showInfo(String title, String message) {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 10),
              Text(message, style: const TextStyle(height: 1.5)),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.profile,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.profile),
          title: const Text('Responsible Gaming'),
        ),
        body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary.withOpacity(.12),
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('18+',
                    style:
                        TextStyle(fontSize: 30, fontWeight: FontWeight.w800)),
                SizedBox(height: 6),
                Text(
                  'N5 Game is intended only for adults where lawful. '
                  'Always follow the laws and eligibility requirements that apply to your location.',
                  style: TextStyle(height: 1.45),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          const Text('Healthy Play',
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          _infoTile(
            icon: Icons.schedule,
            title: 'Set a Time Reminder',
            subtitle: 'Choose whether to receive session-time reminders.',
            onTap: () => setState(() => _sessionReminder = !_sessionReminder),
            trailing: Switch(
              value: _sessionReminder,
              onChanged: (v) => setState(() => _sessionReminder = v),
            ),
          ),
          _infoTile(
            icon: Icons.account_balance_wallet_outlined,
            title: 'Deposit Limit',
            subtitle: 'Set a personal deposit limit where supported.',
            onTap: () => _showInfo(
              'Deposit Limit',
              'Limit settings are controlled by the server and may be subject to applicable provider and regulatory requirements.',
            ),
            trailing: const Icon(Icons.chevron_right),
          ),
          _infoTile(
            icon: Icons.trending_down,
            title: 'Loss Limit',
            subtitle: 'Set a personal loss limit where supported.',
            onTap: () => _showInfo(
              'Loss Limit',
              'Available controls depend on the lawful operating model and applicable provider requirements.',
            ),
            trailing: const Icon(Icons.chevron_right),
          ),
          const SizedBox(height: 16),
          const Text('Account Controls',
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          _infoTile(
            icon: Icons.pause_circle_outline,
            title: 'Take a Break',
            subtitle: 'Temporarily restrict account activity.',
            onTap: () => _showInfo(
              'Take a Break',
              'A break request is submitted to the backend. The exact duration and availability are configured by the operator and applicable requirements.',
            ),
            trailing: const Icon(Icons.chevron_right),
          ),
          _infoTile(
            icon: Icons.block,
            title: 'Self-Exclusion',
            subtitle: 'Request a longer-term restriction where available.',
            onTap: () => setState(() => _selfExclusion = !_selfExclusion),
            trailing: Switch(
              value: _selfExclusion,
              onChanged: (v) => setState(() => _selfExclusion = v),
            ),
          ),
          const SizedBox(height: 16),
          const Text('Important',
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          _infoTile(
            icon: Icons.gavel_outlined,
            title: 'Location & Eligibility',
            subtitle: 'Access is subject to applicable laws, licensing and eligibility rules.',
            onTap: () => _showInfo(
              'Location & Eligibility',
              'N5 Game must enforce applicable age, geographic, licensing, identity and responsible-gaming requirements before production operation.',
            ),
          ),
          _infoTile(
            icon: Icons.support_agent,
            title: 'Need Help?',
            subtitle: 'Contact customer support for account-control assistance.',
            onTap: () => _showInfo(
              'Support',
              'Use the Support section to create a ticket. Emergency or professional support should be obtained from appropriate local services.',
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Control settings shown here are UI examples. Production enforcement must be backend-authoritative and must never rely on the player app alone.',
            style: TextStyle(
              color: Theme.of(context).textTheme.bodySmall?.color,
              height: 1.45,
            ),
          ),
        ],
      ),
    ),
    );
  }

  Widget _infoTile({
    required IconData icon,
    required String title,
    required String subtitle,
    VoidCallback? onTap,
    Widget? trailing,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: Icon(icon),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: trailing,
        onTap: onTap,
      ),
    );
  }
}
