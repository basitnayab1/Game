import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/localization/localization_service.dart';
import '../../../core/navigation/n5_navigation.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.home,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          backgroundColor: const Color(0xFF0B0F17),
          leading: const N5BackButton(fallbackRoute: AppRoutes.home),
          title: Text(context.tr('profile', defaultText: 'Profile'), style: const TextStyle(fontWeight: FontWeight.w800)),
          actions: [
            IconButton(
              onPressed: () => context.push(AppRoutes.settings),
              icon: const Icon(Icons.settings_outlined),
            ),
          ],
        ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _ProfileHeader(),
          const SizedBox(height: 18),
          _SectionCard(
            title: context.tr('preferences', defaultText: 'Preferences'),
            items: [
              _Item(
                Icons.language_rounded,
                '${context.tr('language', defaultText: 'Language')} (${LocalizationService.activeLanguage.nativeName})',
                () => context.push(AppRoutes.language),
              ),
              _Item(
                Icons.tune_rounded,
                context.tr('settings', defaultText: 'Settings'),
                () => context.push(AppRoutes.settings),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _SectionCard(
            title: 'Account',
            items: [
              _Item(Icons.account_balance_wallet_outlined, context.tr('wallet', defaultText: 'Wallet'), () => context.push(AppRoutes.wallet)),
              _Item(Icons.receipt_long_outlined, context.tr('transaction_history', defaultText: 'Transaction History'), () => context.push(AppRoutes.statement)),
              _Item(Icons.card_giftcard_outlined, context.tr('promotions', defaultText: 'Rewards'), () => context.push(AppRoutes.promotions)),
              _Item(Icons.workspace_premium_outlined, context.tr('vip_center', defaultText: 'VIP Center'), () => context.push(AppRoutes.vip)),
            ],
          ),
          const SizedBox(height: 12),
          _SectionCard(
            title: 'Account Services',
            items: [
              _Item(Icons.people_alt_outlined, context.tr('invite', defaultText: 'Referral / Agent'), () => context.push(AppRoutes.referral)),
              _Item(Icons.verified_user_outlined, 'KYC Verification', () => context.push(AppRoutes.kyc)),
              _Item(Icons.security_outlined, context.tr('security_center', defaultText: 'Security & Devices'), () => context.push(AppRoutes.security)),
              _Item(Icons.support_agent_outlined, context.tr('support', defaultText: 'Support'), () => context.push(AppRoutes.support)),
              _Item(Icons.help_outline_rounded, context.tr('faq', defaultText: 'FAQ'), () => context.push(AppRoutes.faq)),
            ],
          ),
          const SizedBox(height: 12),
          _SectionCard(
            title: 'Responsible Use',
            items: [
              _Item(Icons.health_and_safety_outlined, context.tr('responsible_gaming', defaultText: 'Responsible Gaming'), () => context.push(AppRoutes.responsibleGaming)),
              _Item(Icons.person_off_outlined, context.tr('account_closure', defaultText: 'Account Closure'), () => context.push(AppRoutes.accountClosure)),
            ],
          ),
          const SizedBox(height: 18),
          OutlinedButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.logout_rounded),
            label: Text(context.tr('logout', defaultText: 'Logout')),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFFEF4444),
              side: const BorderSide(color: Color(0xFFEF4444)),
              minimumSize: const Size.fromHeight(50),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
        ],
      ),
    ));
  }
}

class _ProfileHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF171E2B),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF293244)),
      ),
      child: Row(
        children: [
          const CircleAvatar(
            radius: 32,
            backgroundColor: Color(0xFF242C3B),
            child: Icon(Icons.person_rounded, size: 34, color: Color(0xFF8B7CFF)),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'N5 Player',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(height: 5),
                Text(
                  'Profile ID: N5-000000',
                  style: TextStyle(color: Color(0xFFA8B0C0), fontSize: 12),
                ),
                SizedBox(height: 5),
                Text(
                  'VIP 1 • Verification pending',
                  style: TextStyle(color: Color(0xFFF5C542), fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final List<_Item> items;

  const _SectionCard({required this.title, required this.items});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF171E2B),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF293244)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 15, 16, 7),
            child: Text(
              title,
              style: const TextStyle(
                color: Color(0xFFA8B0C0),
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          ...items.map(
            (item) => ListTile(
              leading: Icon(item.icon, color: const Color(0xFF8B7CFF)),
              title: Text(
                item.title,
                style: const TextStyle(color: Colors.white, fontSize: 14),
              ),
              trailing: const Icon(
                Icons.chevron_right_rounded,
                color: Color(0xFF6F7889),
              ),
              onTap: item.onTap,
            ),
          ),
        ],
      ),
    );
  }
}

class _Item {
  final IconData icon;
  final String title;
  final VoidCallback onTap;

  const _Item(this.icon, this.title, this.onTap);
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool notifications = true;
  bool securityAlerts = true;
  bool biometric = false;

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.profile,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          backgroundColor: const Color(0xFF0B0F17),
          leading: const N5BackButton(fallbackRoute: AppRoutes.profile),
          title: Text(context.tr('settings', defaultText: 'Settings'), style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _SettingsCard(
            title: context.tr('preferences', defaultText: 'Preferences'),
            children: [
              ValueListenableBuilder<AppLanguage>(
                valueListenable: LocalizationService.languageNotifier,
                builder: (context, lang, _) {
                  return _ActionRow(
                    icon: Icons.language_rounded,
                    title: '${context.tr('language', defaultText: 'Language')}: ${lang.flag} ${lang.nativeName}',
                    onTap: () => context.push(AppRoutes.language),
                  );
                },
              ),
              _SwitchRow(
                icon: Icons.notifications_outlined,
                title: context.tr('notifications', defaultText: 'Notifications'),
                value: notifications,
                onChanged: (v) => setState(() => notifications = v),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _SettingsCard(
            title: 'Security',
            children: [
              _SwitchRow(
                icon: Icons.security_rounded,
                title: 'Security Alerts',
                value: securityAlerts,
                onChanged: (v) => setState(() => securityAlerts = v),
              ),
              _SwitchRow(
                icon: Icons.fingerprint_rounded,
                title: 'Biometric Unlock',
                value: biometric,
                onChanged: (v) => setState(() => biometric = v),
              ),
              _ActionRow(
                icon: Icons.password_rounded,
                title: 'Change Password',
                onTap: () {},
              ),
              _ActionRow(
                icon: Icons.devices_rounded,
                title: 'Manage Devices',
                onTap: () {},
              ),
            ],
          ),
          const SizedBox(height: 12),
          _SettingsCard(
            title: 'Privacy & Legal',
            children: [
              _ActionRow(icon: Icons.privacy_tip_outlined, title: 'Privacy Policy', onTap: () {}),
              _ActionRow(icon: Icons.description_outlined, title: 'Terms & Conditions', onTap: () {}),
              _ActionRow(icon: Icons.health_and_safety_outlined, title: 'Responsible Gaming', onTap: () {}),
              _ActionRow(icon: Icons.person_off_outlined, title: 'Account Closure', onTap: () {}),
            ],
          ),
          const SizedBox(height: 22),
          const Center(
            child: Text(
              'N5 GAME • Version 1.0.0',
              style: TextStyle(color: Color(0xFF6F7889), fontSize: 12),
            ),
          ),
          const SizedBox(height: 5),
          const Center(
            child: Text(
              'Powered by Ali Khan',
              style: TextStyle(color: Color(0xFF6F7889), fontSize: 11),
            ),
          ),
        ],
      ),
    ));
  }
}

class _SettingsCard extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _SettingsCard({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF171E2B),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF293244)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 15, 16, 6),
            child: Text(
              title,
              style: const TextStyle(
                color: Color(0xFFA8B0C0),
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          ...children,
        ],
      ),
    );
  }
}

class _SwitchRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SwitchRow({
    required this.icon,
    required this.title,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      value: value,
      onChanged: onChanged,
      secondary: Icon(icon, color: const Color(0xFF8B7CFF)),
      title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 14)),
      activeColor: const Color(0xFF8B7CFF),
    );
  }
}

class _ActionRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;

  const _ActionRow({
    required this.icon,
    required this.title,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: const Color(0xFF8B7CFF)),
      title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 14)),
      trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFF6F7889)),
      onTap: onTap,
    );
  }
}
